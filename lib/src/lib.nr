use aztec::{
    note::{
        note_interface::NoteHash,
        note_metadata::{NoteMetadata, SettledNoteMetadata},
        retrieved_note::RetrievedNote,
        utils::compute_note_hash_for_nullify,
    },
    prelude::AztecAddress,
    protocol_types::{
        constants::NOTE_HASH_TREE_HEIGHT,
        merkle_tree::{membership::MembershipWitness, root::root_from_sibling_path},
    },
};

pub fn assert_note_inclusion<NOTE>(
    note: NOTE,
    note_nonce: Field,
    membership_witness: MembershipWitness<NOTE_HASH_TREE_HEIGHT>,
    contract_address: AztecAddress,
    storage_slot: Field,
    note_hash_tree_root: Field,
)
where
    NOTE: NoteHash,
{
    // storage proof
    let retrieved_note = RetrievedNote {
        note,
        contract_address,
        metadata: NoteMetadata::from(SettledNoteMetadata::new(note_nonce)),
    };
    let note_hash = compute_note_hash_for_nullify(retrieved_note, storage_slot);
    let computed_root = root_from_sibling_path(
        note_hash,
        membership_witness.leaf_index,
        membership_witness.sibling_path,
    );
    assert(
        computed_root == note_hash_tree_root,
        f"root mismatch: {computed_root} != {note_hash_tree_root}",
    );
}
