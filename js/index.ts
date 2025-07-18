import {
  AztecAddress,
  EthAddress,
  Fr,
  MerkleTreeId,
  type AztecNode,
} from "@aztec/aztec.js";
import type { MembershipWitness } from "@aztec/foundation/trees";
import type { L2BlockNumber } from "@aztec/stdlib/block";
import { mapValues } from "lodash-es";

export class NoteInclusionData {
  readonly note: any;
  readonly note_hash: bigint;

  constructor(fields: Pick<NoteInclusionData, "note" | "note_hash">) {
    this.note = fields.note;
    this.note_hash = fields.note_hash;
  }

  async toNoirInput(node: AztecNode, blockNumber: L2BlockNumber = "latest") {
    if (blockNumber === "latest") {
      blockNumber = await node.getBlockNumber();
    }
    // fetch data
    const [blockHeader, membershipWitness] = await Promise.all([
      node.getBlockHeader(blockNumber),
      getNoteHashTreeMembershipWitness(
        node,
        blockNumber,
        new Fr(this.note_hash),
      ),
    ]);
    if (!blockHeader) {
      throw new Error(`block header for block ${blockNumber} not found`);
    }
    const note_hash_tree_root =
      blockHeader.state.partial.noteHashTree.root.toString();

    // format data for Noir
    const NOTE_SETTLED_STAGE = 3n;
    if (BigInt(this.note.metadata.stage) !== NOTE_SETTLED_STAGE) {
      throw new Error("note is not settled");
    }
    const note_nonce: string = this.note.metadata.maybe_note_nonce.toString();

    const contract_address: string = this.note.contract_address.toString();

    const noteForNoir = mapValues(this.note.note, (v) => {
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
      note_hash_tree_root,
    };
  }

  // async verifyInJs() {
  //   const computedRoot = Fr.fromBuffer(
  //     await computeRootFromSiblingPath(
  //       new Fr(this.note_hash).toBuffer(),
  //       this.membership_witness.sibling_path.map((p) => new Fr(p)),
  //       Number(this.membership_witness.leaf_index),
  //       async (l, r) => (await poseidon2Hash([l, r])).toBuffer(),
  //     ),
  //   );

  //   if (!realRoot.equals(computedRoot)) {
  //     throw new Error("root mismatch");
  //   }
  // }
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
