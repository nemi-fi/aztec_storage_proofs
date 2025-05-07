import "fake-indexeddb/auto";
// @ts-ignore
globalThis.self = globalThis; // needed by pxe https://github.com/AztecProtocol/aztec-packages/issues/14135

import { getInitialTestAccountsManagers } from "@aztec/accounts/testing";
import { createAztecNodeClient, Fr, MerkleTreeId } from "@aztec/aztec.js";
import { poseidon2Hash } from "@aztec/foundation/crypto";
import { computeRootFromSiblingPath } from "@aztec/foundation/trees";
import { type CompiledCircuit } from "@aztec/noir-noir_js";
import { createPXEService, getPXEServiceConfig } from "@aztec/pxe/client/lazy";
import { generateNoteInclusionProof } from "./lib.js";
import { StorageProofContract } from "./target/StorageProof.js";
import example_circuit from "./target_circuits/example_circuit.json" with { type: "json" };

async function main() {
  const node = createAztecNodeClient("http://localhost:8080");
  const config = getPXEServiceConfig();
  config.proverEnabled = false;
  const pxe = await createPXEService(node, config);
  const accounts = await getInitialTestAccountsManagers(pxe);
  const alice = await accounts[0]!.register();

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

  const proof = await generateNoteInclusionProof(
    example_circuit as CompiledCircuit,
    getNoteResult.note,
    getNoteResult.storage_slot,
    realRoot,
    {
      leafIndex: noteHashIndex,
      siblingPath: siblingPath.toFields(),
    },
  );
}

main();
