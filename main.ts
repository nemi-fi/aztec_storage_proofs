import "fake-indexeddb/auto";
// @ts-ignore
globalThis.self = globalThis; // needed by pxe https://github.com/AztecProtocol/aztec-packages/issues/14135

import { getInitialTestAccountsManagers } from "@aztec/accounts/testing";
import { createAztecNodeClient, Fr, MerkleTreeId } from "@aztec/aztec.js";
import { UltraHonkBackend } from "@aztec/bb.js";
import { poseidon2Hash } from "@aztec/foundation/crypto";
import {
  computeRootFromSiblingPath,
  MembershipWitness,
} from "@aztec/foundation/trees";
import { type CompiledCircuit, Noir } from "@aztec/noir-noir_js";
import { createPXEService, getPXEServiceConfig } from "@aztec/pxe/client/lazy";
import { StorageProofContract } from "./target/StorageProof.js";
import example_circuit from "./target_circuits/example_circuit.json";

async function main() {
  const node = createAztecNodeClient("http://localhost:8080");
  const config = getPXEServiceConfig();
  config.proverEnabled = false;
  const pxe = await createPXEService(node, config);
  const accounts = await getInitialTestAccountsManagers(pxe);
  const alice = await accounts[0].register();

  const contract = await StorageProofContract.deploy(alice).send().deployed();
  console.log("deployed at", contract.address.toString());
  const receipt = await contract.methods.set_value(100).send().wait();

  // const contract = await StorageProofContract.at(AztecAddress.fromString(), alice)

  const getNoteResult = (await contract.methods.get_note().simulate()) as {
    note: unknown;
    note_hash: bigint;
    storage_slot: bigint;
  };

  const noteHash = new Fr(getNoteResult.note_hash);

  const blockNumber = receipt.blockNumber!;
  const [indexData] = await node.findLeavesIndexes(
    blockNumber,
    MerkleTreeId.NOTE_HASH_TREE,
    [noteHash],
  );
  if (indexData == null) {
    throw new Error(`note hash not found: ${noteHash}`);
  }
  const noteHashIndex = indexData.data;

  const siblingPath = await node.getNoteHashSiblingPath(
    blockNumber,
    noteHashIndex,
  );

  const blockHeader = await node.getBlockHeader(blockNumber);
  if (!blockHeader) {
    throw new Error("block not found");
  }
  const realRoot = blockHeader.state.partial.noteHashTree.root;

  const computedRoot = Fr.fromBuffer(
    await computeRootFromSiblingPath(
      noteHash.toBuffer(),
      siblingPath.toBufferArray(),
      Number(noteHashIndex),
      async (l, r) => (await poseidon2Hash([l, r])).toBuffer(),
    ),
  );

  console.log("membershipWitness", siblingPath);
  console.log("getNoteResult", getNoteResult);
  console.log("index", noteHashIndex);
  console.log("note", noteHash);
  console.log("computed root", computedRoot);
  console.log("real root", realRoot);

  if (!realRoot.equals(computedRoot)) {
    throw new Error("root mismatch");
  }

  const proof = await generateStorageProof(
    getNoteResult.note,
    getNoteResult.storage_slot,
    realRoot,
    {
      leafIndex: noteHashIndex,
      siblingPath: siblingPath.toFields(),
    },
  );
}

async function generateStorageProof(
  note: any,
  storageSlot: bigint,
  realRoot: Fr,
  membershipWitness: Pick<
    MembershipWitness<number>,
    "leafIndex" | "siblingPath"
  >,
) {
  const noir = new Noir(example_circuit as CompiledCircuit);
  const backend = new UltraHonkBackend(example_circuit.bytecode);

  const NOTE_SETTLED_STAGE = 3n;
  if (BigInt(note.metadata.stage) !== NOTE_SETTLED_STAGE) {
    throw new Error("note is not settled");
  }
  const note_nonce = note.metadata.maybe_nonce.toString();

  const { witness } = await noir.execute({
    note: {
      value: note.note.value.toString(),
      owner: { inner: note.note.owner.toString() },
      randomness: note.note.randomness.toString(),
    },
    note_nonce,
    contract_address: note.contract_address.toString(),
    membership_witness: {
      leaf_index: membershipWitness.leafIndex.toString(),
      sibling_path: membershipWitness.siblingPath.map((p) => p.toString()),
    },
    expected_value: note.note.value.toString(),
    storage_slot: storageSlot.toString(),
    real_note_hash_tree_root: realRoot.toString(),
  });
  console.log("witness", witness.length);

  console.time("generateProof");
  const proof = await backend.generateProof(witness);
  console.timeEnd("generateProof");
  return proof;
}

main();
