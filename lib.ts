import type { Fr } from "@aztec/aztec.js";
import { UltraHonkBackend } from "@aztec/bb.js";
import type { MembershipWitness } from "@aztec/foundation/trees";
import { type CompiledCircuit, Noir } from "@aztec/noir-noir_js";

export async function generateNoteInclusionProof(
  circuit: CompiledCircuit,
  noteData: any,
  storageSlot: bigint,
  realRoot: Fr,
  membershipWitness: Pick<
    MembershipWitness<number>,
    "leafIndex" | "siblingPath"
  >,
) {
  const noir = new Noir(circuit);
  const backend = new UltraHonkBackend(circuit.bytecode);

  const NOTE_SETTLED_STAGE = 3n;
  if (BigInt(noteData.metadata.stage) !== NOTE_SETTLED_STAGE) {
    throw new Error("note is not settled");
  }
  const note_nonce = noteData.metadata.maybe_nonce.toString();

  const { witness } = await noir.execute({
    note: {
      value: noteData.note.value.toString(),
      owner: { inner: noteData.note.owner.toString() },
      randomness: noteData.note.randomness.toString(),
    },
    note_nonce,
    contract_address: noteData.contract_address.toString(),
    membership_witness: {
      leaf_index: membershipWitness.leafIndex.toString(),
      sibling_path: membershipWitness.siblingPath.map((p) => p.toString()),
    },
    expected_value: noteData.note.value.toString(),
    storage_slot: storageSlot.toString(),
    real_note_hash_tree_root: realRoot.toString(),
  });
  console.log("witness", witness.length);

  console.time("generateProof");
  const proof = await backend.generateProof(witness);
  console.timeEnd("generateProof");
  return proof;
}
