import "fake-indexeddb/auto";
// @ts-ignore
globalThis.self = globalThis; // needed by pxe https://github.com/AztecProtocol/aztec-packages/issues/14135

import { getInitialTestAccountsData } from "@aztec/accounts/testing";
import { createAztecNodeClient } from "@aztec/aztec.js/node";
import { UltraHonkBackend } from "@aztec/bb.js";
import { Noir, type CompiledCircuit, type InputMap } from "@aztec/noir-noir_js";
import { getPXEConfig } from "@aztec/pxe/client/bundle";
import { TestWallet } from "@aztec/test-wallet/server";
import { expect, test } from "vitest";
import { NoteInclusionData } from "./js/index.js";
import { StorageProofContract } from "./target/StorageProof.js";
import example_circuit from "./target_circuits/example_circuit.json" with { type: "json" };

test("flow", async () => {
  const node = createAztecNodeClient("http://localhost:8080");
  const config = getPXEConfig();
  config.proverEnabled = false;
  const accounts = await getInitialTestAccountsData();
  const wallet = await TestWallet.create(node);
  const alice = await (
    await wallet.createSchnorrAccount(accounts[0]!.secret, accounts[0]!.salt)
  ).getAccount();

  const contract = await StorageProofContract.deploy(wallet)
    .send({ from: alice.getAddress() })
    .deployed();
  console.log("deployed at", contract.address.toString());

  await setValueAndTestProof(100);
  await setValueAndTestProof(200);

  async function setValueAndTestProof(value: number) {
    await contract.methods
      .set_value(value)
      .send({ from: alice.getAddress() })
      .wait();

    const noteInclusionData = new NoteInclusionData(
      await contract.methods
        .get_note(alice.getAddress())
        .simulate({ from: alice.getAddress() }),
    );

    const input = await noteInclusionData.toNoirInput(node);

    expect(BigInt(noteInclusionData.note.note.value)).toBe(BigInt(value)); // sanity check

    const proof = await generateProof(example_circuit as CompiledCircuit, {
      ...input,
      map_storage_slot: 1, // position in `struct Storage` (1-based indexing)
      expected_value: noteInclusionData.note.note.value.toString(),
    });
    console.log("proof", proof.proof.length);
  }
});

async function generateProof(circuit: CompiledCircuit, input: InputMap) {
  const noir = new Noir(circuit);
  const backend = new UltraHonkBackend(circuit.bytecode);

  const { witness } = await noir.execute(input);

  console.time("generateProof");
  const proof = await backend.generateProof(witness);
  console.timeEnd("generateProof");
  return proof;
}
