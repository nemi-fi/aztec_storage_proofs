import {
  AztecAddress,
  EthAddress,
  Fr,
  MerkleTreeId,
  type AztecNode,
} from "@aztec/aztec.js";
import type { MembershipWitness } from "@aztec/foundation/trees";
import { mapValues } from "lodash-es";

export async function getNoteInclusionInputForNoir(
  node: AztecNode,
  noteInclusionData: NoteInclusionData,
) {
  // fetch data
  const blockNumber = await node.getBlockNumber();
  const [blockHeader, membershipWitness] = await Promise.all([
    node.getBlockHeader(blockNumber),
    getNoteHashTreeMembershipWitness(
      node,
      blockNumber,
      new Fr(noteInclusionData.note_hash),
    ),
  ]);
  if (!blockHeader) {
    throw new Error(`block header for block ${blockNumber} not found`);
  }
  const note_hash_tree_root =
    blockHeader.state.partial.noteHashTree.root.toString();

  // format data for Noir
  const NOTE_SETTLED_STAGE = 3n;
  if (BigInt(noteInclusionData.note.metadata.stage) !== NOTE_SETTLED_STAGE) {
    throw new Error("note is not settled");
  }
  const note_nonce: string =
    noteInclusionData.note.metadata.maybe_nonce.toString();

  const contract_address: string =
    noteInclusionData.note.contract_address.toString();

  const noteForNoir = mapValues(noteInclusionData.note.note, (v) => {
    if (typeof v === "bigint") {
      return v.toString();
    }
    if (AztecAddress.isAddress(v.toString())) {
      return { inner: v.toString() };
    }
    if (EthAddress.isAddress(v.toString())) {
      return { inner: v.toString() };
    }
    return v;
  });
  return {
    note: noteForNoir,
    note_nonce,
    contract_address,
    membership_witness: {
      leaf_index: membershipWitness.leafIndex.toString(),
      sibling_path: membershipWitness.siblingPath.map((p) => p.toString()),
    },
    storage_slot: noteInclusionData.storage_slot.toString(),
    note_hash_tree_root,
  };
}

export interface NoteInclusionData {
  note: any;
  note_hash: bigint;
  storage_slot: bigint;
}

async function getNoteHashTreeMembershipWitness(
  node: AztecNode,
  blockNumber: number,
  noteHash: Fr,
): Promise<Pick<MembershipWitness<number>, "leafIndex" | "siblingPath">> {
  const [indexData] = await node.findLeavesIndexes(
    blockNumber,
    MerkleTreeId.NOTE_HASH_TREE,
    [noteHash],
  );
  if (indexData == null) {
    throw new Error(`note hash not found: ${noteHash}`);
  }
  const noteHashIndex = indexData.data;

  const siblingPath = await node.getNoteHashSiblingPath(
    blockNumber,
    noteHashIndex,
  );
  return { leafIndex: noteHashIndex, siblingPath: siblingPath.toFields() };
}
