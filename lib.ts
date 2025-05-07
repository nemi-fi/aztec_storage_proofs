import { AztecAddress, type Fr } from "@aztec/aztec.js";
import { UltraHonkBackend } from "@aztec/bb.js";
import type { MembershipWitness } from "@aztec/foundation/trees";
import { type CompiledCircuit, Noir } from "@aztec/noir-noir_js";
import { mapValues } from "lodash-es";

export async function generateNoteInclusionProof(
  circuit: CompiledCircuit,
  noteData: NoteData,
  realRoot: Fr,
  membershipWitness: Pick<
    MembershipWitness<number>,
    "leafIndex" | "siblingPath"
  >,
) {
  const noir = new Noir(circuit);
  const backend = new UltraHonkBackend(circuit.bytecode);

  const NOTE_SETTLED_STAGE = 3n;
  if (BigInt(noteData.note.metadata.stage) !== NOTE_SETTLED_STAGE) {
    throw new Error("note is not settled");
  }
  const note_nonce = noteData.note.metadata.maybe_nonce.toString();

  const noteForNoir = mapValues(noteData.note.note, (v) => {
    if (typeof v === "bigint") {
      return v.toString();
    }
    if (AztecAddress.isAddress(v.toString())) {
      return { inner: v.toString() };
    }
    return v;
  });
  const { witness } = await noir.execute({
    note: noteForNoir,
    note_nonce,
    contract_address: noteData.note.contract_address.toString(),
    membership_witness: {
      leaf_index: membershipWitness.leafIndex.toString(),
      sibling_path: membershipWitness.siblingPath.map((p) => p.toString()),
    },
    expected_value: noteData.note.note.value.toString(),
    storage_slot: noteData.storage_slot.toString(),
    real_note_hash_tree_root: realRoot.toString(),
  });
  console.log("witness", witness.length);

  console.time("generateProof");
  const proof = await backend.generateProof(witness);
  console.timeEnd("generateProof");
  return proof;
}

export interface NoteData {
  note: any;
  note_hash: bigint;
  storage_slot: bigint;
}
