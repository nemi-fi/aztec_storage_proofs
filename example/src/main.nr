use aztec::macros::aztec;

#[aztec]
contract StorageProof {
    use aztec::{
        macros::{functions::{private, utility, view}, storage::storage},
        messages::logs::note::encode_and_encrypt_note,
        note::{
            note_getter::get_notes, retrieved_note::RetrievedNote,
            utils::compute_note_hash_for_nullify,
        },
        prelude::{NoteGetterOptions, PrivateMutable},
        protocol_types::traits::Serialize,
        state_vars::storage::Storage as _,
    };

    use uint_note::uint_note::UintNote;

    #[storage]
    struct Storage<C> {
        value: PrivateMutable<UintNote, C>,
    }

    #[private]
    fn set_value(value: u128) {
        let sender = context.msg_sender();
        storage.value.initialize_or_replace(UintNote::new(value, sender)).emit(
            encode_and_encrypt_note(&mut context, sender, sender),
        );
    }

    #[utility]
    unconstrained fn get_value() -> u128 {
        storage.value.view_note().get_value()
    }

    #[private]
    #[view]
    fn get_note() -> pub NoteData<UintNote> {
        let storage_slot = storage.value.get_storage_slot();

        let mut options = NoteGetterOptions::new();
        options = options.set_limit(1);
        let (retrieved_notes, _): (BoundedVec<RetrievedNote<UintNote>, _>, _) =
            get_notes(&mut context, storage_slot, options);
        let note = retrieved_notes.get(0);
        let note_hash = compute_note_hash_for_nullify(note, storage_slot);
        NoteData { note, note_hash, storage_slot }
    }

    pub struct NoteData<Note> {
        pub note: RetrievedNote<Note>,
        pub note_hash: Field,
        pub storage_slot: Field,
    }

    impl<Note, let N: u32> Serialize<N + 3 + 2> for NoteData<Note>
    where
        Note: Serialize<N>,
    {
        fn serialize(self) -> [Field; N + 3 + 2] {
            let a = self.note.serialize();
            let b = a.concat([self.note_hash, self.storage_slot]);
            b
        }
    }
}
