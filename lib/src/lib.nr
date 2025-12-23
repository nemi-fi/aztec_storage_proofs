use aztec::{
    context::PrivateContext,
    note::{
        note_getter::get_note,
        note_interface::{NoteHash, NoteType},
        note_metadata::{NoteMetadata, SettledNoteMetadata},
        retrieved_note::RetrievedNote,
        utils::compute_note_hash_for_nullification,
    },
    protocol_types::{
        address::AztecAddress,
        constants::NOTE_HASH_TREE_HEIGHT,
        merkle_tree::{membership::MembershipWitness, root::root_from_sibling_path},
        traits::{Deserialize, Packable, Serialize},
    },
};

pub fn assert_note_inclusion<NOTE>(
    note: NOTE,
    note_nonce: Field,
    randomness: Field,
    membership_witness: MembershipWitness<NOTE_HASH_TREE_HEIGHT>,
    contract_address: AztecAddress,
    storage_slot: Field,
    owner: AztecAddress,
    note_hash_tree_root: Field,
)
where
    NOTE: NoteHash,
{
    // storage proof
    let retrieved_note = RetrievedNote {
        note,
        contract_address,
        storage_slot,
        owner,
        metadata: NoteMetadata::from(SettledNoteMetadata::new(note_nonce)),
        randomness,
    };
    let note_hash = compute_note_hash_for_nullification(retrieved_note);
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

pub fn get_note_inclusion_data<NOTE>(
    context: &mut PrivateContext,
    storage_slot: Field,
    owner: Option<AztecAddress>,
) -> NoteInclusionData<NOTE>
where
    NOTE: NoteType + NoteHash + Packable,
{
    let (note, _) = get_note(context, owner, storage_slot);
    let note_hash = compute_note_hash_for_nullification(note);
    NoteInclusionData { note, note_hash }
}

#[derive(Serialize, Deserialize)]
pub struct NoteInclusionData<Note> {
    pub note: RetrievedNote<Note>,
    pub note_hash: Field,
}
