use aztec::macros::aztec;

#[aztec]
contract StorageProof {
    use aztec::{
        macros::{functions::{private, utility, view}, storage::storage},
        messages::logs::note::encode_and_encrypt_note,
        prelude::{AztecAddress, Map, NoteGetterOptions, PrivateMutable},
    };

    use uint_note::uint_note::UintNote;

    #[storage]
    struct Storage<C> {
        value: Map<AztecAddress, PrivateMutable<UintNote, C>, C>,
    }

    #[private]
    fn set_value(value: u128) {
        let sender = context.msg_sender();
        storage.value.at(sender).initialize_or_replace(UintNote::new(value, sender)).emit(
            encode_and_encrypt_note(&mut context, sender, sender),
        );
    }

    #[utility]
    unconstrained fn get_value(owner: AztecAddress) -> u128 {
        storage.value.at(owner).view_note().get_value()
    }

    #[private]
    #[view]
    fn get_note(owner: AztecAddress) -> pub storage_proofs::NoteInclusionData<UintNote> {
        let mut options = NoteGetterOptions::new();
        options = options.set_limit(1);
        storage_proofs::get_note_inclusion_data(&mut context, storage.value.at(owner), options)
    }
}
