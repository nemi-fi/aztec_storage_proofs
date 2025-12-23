use aztec::macros::aztec;

#[aztec]
contract StorageProof {
    use aztec::{
        macros::{functions::{external, view}, storage::storage},
        messages::message_delivery::MessageDelivery,
        protocol_types::address::AztecAddress,
        state_vars::{Owned, PrivateMutable, StateVariable},
    };

    use uint_note::uint_note::UintNote;

    #[storage]
    struct Storage<C> {
        value: Owned<PrivateMutable<UintNote, C>, C>,
    }

    #[external("private")]
    fn set_value(value: u128) {
        let sender = self.msg_sender().expect(f"sender is not set");
        self.storage.value.at(sender).initialize_or_replace(|_| UintNote { value }).deliver(
            MessageDelivery.CONSTRAINED_ONCHAIN,
        );
    }

    #[external("utility")]
    unconstrained fn get_value(owner: AztecAddress) -> u128 {
        self.storage.value.at(owner).view_note().value
    }

    #[external("private")]
    #[view]
    fn get_note(owner: AztecAddress) -> pub storage_proofs::NoteInclusionData<UintNote> {
        storage_proofs::get_note_inclusion_data(
            self.context,
            self.storage.value.get_storage_slot(),
            Option::some(owner),
        )
    }
}
