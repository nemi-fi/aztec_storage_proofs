import "fake-indexeddb/auto";
// @ts-ignore
globalThis.self = globalThis; // needed by pxe https://github.com/AztecProtocol/aztec-packages/issues/14135

import { getInitialTestAccountsManagers } from "@aztec/accounts/testing";
import { createAztecNodeClient, Fr, MerkleTreeId, PXE } from "@aztec/aztec.js";
import { poseidon2Hash } from "@aztec/foundation/crypto";
import { computeRootFromSiblingPath } from "@aztec/foundation/trees";
import {
  createPXEService,
  getPXEServiceConfig,
  type PXEOracleInterface,
} from "@aztec/pxe/client/lazy";
import { StorageProofContract } from "./target/StorageProof.js";

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

  const noteHash = new Fr(
    (await contract.methods.get_note().simulate()) as bigint,
  );

  const blockNumber = receipt.blockNumber!;
  const membershipWitness = await getMembershipWitness(
    pxe,
    blockNumber,
    noteHash,
  );

  const [indexData] = await node.findLeavesIndexes(
    blockNumber,
    MerkleTreeId.NOTE_HASH_TREE,
    [noteHash],
  );
  if (indexData == null) {
    throw new Error(`note hash not found: ${noteHash}`);
  }
  const index = indexData.data;

  const computedRoot = Fr.fromBuffer(
    await computeRootFromSiblingPath(
      noteHash.toBuffer(),
      membershipWitness.map((x) => x.toBuffer()),
      Number(index),
      async (l, r) => (await poseidon2Hash([l, r])).toBuffer(),
    ),
  );
  const blockHeader = await node.getBlockHeader(blockNumber);
  if (!blockHeader) {
    throw new Error("block not found");
  }
  const realRoot = blockHeader.state.partial.noteHashTree.root;
  console.log("membershipWitness", membershipWitness);
  console.log("index", index);
  console.log("note", noteHash);
  console.log("computed root", computedRoot);
  console.log("real root", realRoot);

  if (!realRoot.equals(computedRoot)) {
    throw new Error("root mismatch");
  }
}

async function getMembershipWitness(
  pxe: PXE,
  blockNumber: number,
  noteHash: Fr,
) {
  // TODO: remove type cast
  const pxe2: PXE & Pick<PXEOracleInterface, "getMembershipWitness"> = (
    pxe as any
  ).simulator.executionDataProvider;
  return await pxe2.getMembershipWitness(
    blockNumber,
    MerkleTreeId.NOTE_HASH_TREE,
    noteHash,
  );
}

main();
