import "fake-indexeddb/auto";
// @ts-ignore
globalThis.self = globalThis;

import { getInitialTestAccountsManagers } from "@aztec/accounts/testing";
import { createAztecNodeClient, Fr, MerkleTreeId, PXE } from "@aztec/aztec.js";
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

  const noteHash = (await contract.methods.get_note().simulate()) as bigint;

  const membershipWitness = await getMembershipWitness(
    pxe,
    receipt.blockNumber!,
    new Fr(noteHash),
  );
  console.log("membershipWitness", membershipWitness);
  console.log("note", noteHash);
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
