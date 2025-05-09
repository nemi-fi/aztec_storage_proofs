import "fake-indexeddb/auto";
// @ts-ignore
globalThis.self = globalThis; // needed by pxe https://github.com/AztecProtocol/aztec-packages/issues/14135

import { getInitialTestAccountsManagers } from "@aztec/accounts/testing";
import { createAztecNodeClient } from "@aztec/aztec.js";
import { UltraHonkBackend } from "@aztec/bb.js";
import { Noir, type CompiledCircuit, type InputMap } from "@aztec/noir-noir_js";
import {
  createPXEService,
  getPXEServiceConfig,
} from "@aztec/pxe/client/bundle";
import { test } from "vitest";
import { NoteInclusionData } from "./js/index.js";
import { StorageProofContract } from "./target/StorageProof.js";
import example_circuit from "./target_circuits/example_circuit.json" with { type: "json" };

test("flow", async () => {
  const node = createAztecNodeClient("http://localhost:8080");
  const config = getPXEServiceConfig();
  config.proverEnabled = false;
  const pxe = await createPXEService(node, config);
  const accounts = await getInitialTestAccountsManagers(pxe);
  const alice = await accounts[0]!.register();

  const contract = await StorageProofContract.deploy(alice).send().deployed();
  console.log("deployed at", contract.address.toString());
  await contract.methods.set_value(100).send().wait();

  const noteInclusionData = new NoteInclusionData(
    await contract.methods.get_note(alice.getAddress()).simulate(),
  );

  const input = await noteInclusionData.toNoirInput(node);
  const proof = await generateProof(example_circuit as CompiledCircuit, {
    ...input,
    map_storage_slot: 1, // position in `struct Storage` (1-based indexing)
    expected_value: noteInclusionData.note.note.value.toString(),
  });
  console.log("proof", proof.proof.length);
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
