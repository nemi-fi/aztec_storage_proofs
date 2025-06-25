use aztec::{
    note::{
        note_getter::get_notes,
        note_interface::{NoteHash, NoteType},
        note_metadata::{NoteMetadata, SettledNoteMetadata},
        retrieved_note::RetrievedNote,
        utils::compute_note_hash_for_nullify,
    },
    prelude::{AztecAddress, NoteGetterOptions, PrivateContext},
    protocol_types::{
        constants::NOTE_HASH_TREE_HEIGHT,
        merkle_tree::{membership::MembershipWitness, root::root_from_sibling_path},
        traits::{Packable, Serialize},
    },
    state_vars::storage::Storage,
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

pub fn get_note_inclusion_data<NOTE, let N: u32, PREPROCESSOR_ARGS, FILTER_ARGS>(
    context: &mut PrivateContext,
    storage_var: impl Storage<_>,
    options: NoteGetterOptions<NOTE, _, PREPROCESSOR_ARGS, FILTER_ARGS>,
) -> NoteInclusionData<NOTE>
where
    NOTE: NoteType + NoteHash + Packable<N> + Eq,
{
    let storage_slot = storage_var.get_storage_slot();
    let (retrieved_notes, _): (BoundedVec<RetrievedNote<NOTE>, _>, _) =
        get_notes::<NOTE, _, PREPROCESSOR_ARGS, FILTER_ARGS>(context, storage_slot, options);
    let note = retrieved_notes.get(0);
    let note_hash = compute_note_hash_for_nullify(note, storage_slot);
    NoteInclusionData { note, note_hash }
}

pub struct NoteInclusionData<Note> {
    pub note: RetrievedNote<Note>,
    pub note_hash: Field,
}

impl<Note, let N: u32> Serialize<N + 3 + 1> for NoteInclusionData<Note>
where
    Note: Serialize<N>,
{
    fn serialize(self) -> [Field; N + 3 + 1] {
        let a = self.note.serialize();
        let b = a.concat([self.note_hash]);
        b
    }
}
