use aztec::macros::aztec;

#[aztec]
contract StorageProof {
    use aztec::{
        macros::{functions::{private, utility, view}, storage::storage},
        messages::logs::note::encode_and_encrypt_note,
        prelude::{NoteGetterOptions, PrivateMutable},
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
    fn get_note() -> pub storage_proofs::NoteData<UintNote> {
        let mut options = NoteGetterOptions::new();
        options = options.set_limit(1);
        storage_proofs::get_note_inclusion_data(&mut context, storage.value, options)
    }

}
