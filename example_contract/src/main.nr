use aztec::macros::aztec;

#[aztec]
contract StorageProof {
    use aztec::{
        macros::{functions::{external, view}, storage::storage},
        messages::message_delivery::MessageDelivery,
        note::note_getter_options::NoteGetterOptions,
        protocol_types::address::AztecAddress,
        state_vars::{Map, PrivateMutable},
    };

    use uint_note::uint_note::UintNote;

    #[storage]
    struct Storage<C> {
        value: Map<AztecAddress, PrivateMutable<UintNote, C>, C>,
    }

    #[external("private")]
    fn set_value(value: u128) {
        let sender = context.msg_sender().expect(f"sender is not set");
        storage.value.at(sender).initialize_or_replace(|_| UintNote::new(value, sender)).emit(
            sender,
            MessageDelivery.CONSTRAINED_ONCHAIN,
        );
    }

    #[external("utility")]
    unconstrained fn get_value(owner: AztecAddress) -> u128 {
        storage.value.at(owner).view_note().get_value()
    }

    #[external("private")]
    #[view]
    fn get_note(owner: AztecAddress) -> pub storage_proofs::NoteInclusionData<UintNote> {
        let mut options = NoteGetterOptions::new();
        options = options.set_limit(1);
        storage_proofs::get_note_inclusion_data(&mut context, storage.value.at(owner), options)
    }
}
