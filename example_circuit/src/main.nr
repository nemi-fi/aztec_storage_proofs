use aztec::protocol_types::{
    address::AztecAddress, constants::NOTE_HASH_TREE_HEIGHT,
    merkle_tree::membership::MembershipWitness, traits::FromField,
};
use uint_note::uint_note::UintNote;

fn main(
    note: UintNote,
    // The owner of the note.
    owner: Field,
    // The membership witness for the note hash in the note hash tree.
    membership_witness: MembershipWitness<NOTE_HASH_TREE_HEIGHT>,
    // The nonce of the note for the note hash.
    note_nonce: Field,
    // The randomness of the note.
    randomness: Field,
    // The Aztec smart contract address.
    contract_address: pub Field,
    // The storage slot of the mapping in the contract.
    map_storage_slot: pub Field,
    // The expected value of the note.
    expected_value: pub u128,
    // The real root of the note hash tree.
    note_hash_tree_root: pub Field,
) {
    let real_value = note.value;
    assert(real_value == expected_value, f"value mismatch: {real_value} != {expected_value}");

    storage_proofs::assert_note_inclusion(
        note,
        note_nonce,
        randomness,
        membership_witness,
        AztecAddress::from_field(contract_address),
        map_storage_slot,
        AztecAddress::from_field(owner),
        note_hash_tree_root,
    );
}
