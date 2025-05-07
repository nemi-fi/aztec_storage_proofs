use aztec::{
    note::{
        note_metadata::{NoteMetadata, SettledNoteMetadata},
        retrieved_note::RetrievedNote,
        utils::compute_note_hash_for_nullify,
    },
    prelude::AztecAddress,
    protocol_types::{
        constants::NOTE_HASH_TREE_HEIGHT,
        merkle_tree::{membership::MembershipWitness, root::root_from_sibling_path},
        traits::FromField,
    },
};
use uint_note::uint_note::UintNote;

fn main(
    note: UintNote,
    // The membership witness for the note hash in the note hash tree.
    membership_witness: MembershipWitness<NOTE_HASH_TREE_HEIGHT>,
    // The storage slot of the note within the contract. Can leak info, so has to be private.
    storage_slot: Field,
    // The nonce of the note for the note hash.
    note_nonce: Field,
    // The Aztec smart contract address.
    contract_address: pub Field,
    // The expected value of the note.
    expected_value: pub u128,
    // The real root of the note hash tree.
    real_note_hash_tree_root: pub Field,
) {
    let real_value = note.get_value();
    assert(real_value == expected_value, f"value mismatch: {real_value} != {expected_value}");

    // storage proof
    let retrieved_note = RetrievedNote {
        note,
        contract_address: AztecAddress::from_field(contract_address),
        metadata: NoteMetadata::from(SettledNoteMetadata::new(note_nonce)),
    };
    let note_hash = compute_note_hash_for_nullify(retrieved_note, storage_slot);
    let computed_root = root_from_sibling_path(
        note_hash,
        membership_witness.leaf_index,
        membership_witness.sibling_path,
    );
    assert(
        computed_root == real_note_hash_tree_root,
        f"root mismatch: {computed_root} != {real_note_hash_tree_root}",
    );
}
