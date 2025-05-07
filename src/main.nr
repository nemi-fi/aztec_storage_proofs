use aztec::macros::aztec;

#[aztec]
contract StorageProof {
    use aztec::{
        macros::{functions::{private, utility, view}, storage::storage},
        messages::logs::note::encode_and_encrypt_note,
        note::{
            note_getter::{get_notes, view_notes},
            retrieved_note::RetrievedNote,
            utils::compute_note_hash_for_nullify,
        },
        prelude::{NoteGetterOptions, NoteViewerOptions, PrivateMutable},
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
    fn get_note2() -> pub Field {
        let mut options = NoteGetterOptions::new();
        options = options.set_limit(1);
        let (retrieved_notes, _): (BoundedVec<RetrievedNote<UintNote>, _>, _) =
            get_notes(&mut context, storage.value.storage_slot, options);
        let note = retrieved_notes.get(0);
        let note_hash = compute_note_hash_for_nullify(note, storage.value.storage_slot);
        // (note.note.get_value(), note_hash)
        note_hash
    }

    #[utility]
    unconstrained fn get_note() -> UintNote {
        let mut options: NoteViewerOptions<UintNote, _> = NoteViewerOptions::new();
        options = options.set_limit(1);
        let notes = view_notes(storage.value.storage_slot, options);
        let note = notes.get(0);
        note
    }
}
