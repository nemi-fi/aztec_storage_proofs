use aztec::{
    prelude::AztecAddress,
    protocol_types::{
        constants::NOTE_HASH_TREE_HEIGHT,
        merkle_tree::membership::MembershipWitness,
        storage::map::derive_storage_slot_in_map,
        traits::{FromField, ToField},
    },
};
use uint_note::uint_note::UintNote;

fn main(
    note: UintNote,
    // The membership witness for the note hash in the note hash tree.
    membership_witness: MembershipWitness<NOTE_HASH_TREE_HEIGHT>,
    // The storage slot of the note within the contract. Can leak info, so has to be private.
    map_storage_slot: Field,
    // The nonce of the note for the note hash.
    note_nonce: Field,
    // The Aztec smart contract address.
    contract_address: pub Field,
    // The expected value of the note.
    expected_value: pub u128,
    // The real root of the note hash tree.
    note_hash_tree_root: pub Field,
) {
    let real_value = note.get_value();
    assert(real_value == expected_value, f"value mismatch: {real_value} != {expected_value}");

    let storage_slot = derive_storage_slot_in_map(map_storage_slot, note.owner.to_field());
    storage_proofs::assert_note_inclusion(
        note,
        note_nonce,
        membership_witness,
        AztecAddress::from_field(contract_address),
        storage_slot,
        note_hash_tree_root,
    );
}
