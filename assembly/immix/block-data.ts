// @ts-nocheck

import { lineCount, headerLineCount } from "./consts";
import { BlockState } from "./block";
import { LineFlags } from "./line";

type StandardObjectAddress = usize;
class LineData extends Uint8Array { }

class BlockHeader {
  /* Chunk description only valid in the first block data of a chunk */
  chunkHeaderPadding: Uint8Array = new Uint8Array(sizeof<ChunkHeader>());

  bumpCursor: u32;
  bumpCursorLimit: u32;
  state: BlockState;
  usedLineCount: u8;
  consecutiveUsedLineCount: u8;
  pinned: u8;
  blockIndex: u8;

  /* One LineFlags per line */
  padding: LineData;

  lineFlags: LineFlags[] = new Array<LineFlags>(lineCount);
}

/**
  A block data is storing allocated object into lines. It contains a simple
  metadata in the header for each line (LineFlags).
	*/
@unmanaged
export class BlockData {
  header: BlockHeader;

  lines: LineData[] = new Array<LineData>(lineCount);

  next: Block;
  prev: Block;

  bytesAvailable: usize;

  //@inline
  isRecyclable(): bool {
    return this.header.state === BlockState.RECYCLABLE;
  }

  //@inline
  isOccupied(): bool {
    return this.header.state === BlockState.OCCUPIED;
  }

  //@inline
  isFree(): bool {
    return this.header.state === BlockState.FREE;
  }

  //@inline
  isLocked(): bool {
    return this.header.state === BlockState.LOCKED;
  }

  /**
		Determines whether the specified line in this block contains an object.
	*/
  //@inline
  containsObject(lineIndex: u8): bool {
    assert(lineIndex >= headerLineCount);
    return (this.header.lineFlags[lineIndex] & LineFlags.CONTAINS_OBJECT) != 0;
  }

  /**
    Gets the first object stored at the specified line. ContainsObject() must be
    called before calling this method
  */
  //@inline
  getFirstObject(lineIndex: u8): StandardObjectAddress {
    assert(this.containsObject(lineIndex));
    const offset = (this.header.lineFlags[lineIndex] &
      LineFlags.FIRST_OBJECT_OFFSET_MASK) as u8;
    return this.lines[lineIndex][offset] as StandardObjectAddress;
  }

  /**
    Get the block associated with this address
  */
  //@inline
  static fromObject(object: StandardObjectAddress): BlockData {
    assert(object != null);
    assert(object.isStandardObject());

    return changetype<BlockData>(object & blockSizeInBytesInverseMask);
  }

  /**
    Mark lines associated with the specified object.
  */
  @inline
  markLines(object: StandardObjectAddress): void {
    const offset: u32 = changetype<usize>(object) - changetype<usize>(this);
    const lineFrom: u32 = offset >> lineBits;
    const lineTo: u32 = (offset + object.size()) >> lineBits;
    for (let i: u32 = lineFrom;i <= lineTo;i++) {
      let lineFlags: LineFlags = this.header.lineFlags[i];
      lineFlags |= LineFlags.MARKED;
    }
    this.header.blockFlags = BlockState.OCCUPIED;
  }

  /**
    Clears this block as not marked. This is performed before a new full 
    collection.
  */
  @inline
  clearMarked() {
    this.header.blockFlags = BlockState.FREE;
    for (let i: u32 = headerLineCount;i < lineCount;i++) {
      this.header.lineFlags[i] &= ~LineFlags.MARKED;
    }
  }

  /**
    Initialize this block
  */
  @inline
  initialize(): void {
    // Set the header and line flags to zero
    let pLines = changetype<u32>(this);
    for (let i: u32 = 0;i < sizeof(this.header) / sizeof(u32);i++) {
      pLines++ = 0;
    }

    this.header.bumpCursor = headerSizeInBytes;
  }


  /**
    Sets the state of this block
  */
  setFlags(state: BlockState): void {
    this.header.state = state;
  }

  /**
    Clears unmarked lines and mark the block free, recyclable or marked.
  */
  recycle(): void {
    this.header.bumpCursor = 0;
    this.header.bumpCursorLimit = 0;
    this.header.usedLineCount = 0;
    this.header.consecutiveUsedLineCount = 0;

    // If the block is marked, check if it is recyclable (at least one free line)
    if (IsUnavailable()) {
      let previousLineWasUsed: bool = false;
      for (let i: u32 = headerLineCount;i < lineCount;i++) {
        if ((this.header.lineFlags[i] & LineFlags.MARKED) != 0) {
          this.header.usedLineCount++;
          if (previousLineWasUsed) {
            this.header.consecutiveUsedLineCount++;
          }
          previousLineWasUsed = true;
          if (this.header.bumpCursorLimit == 0 && this.header.bumpCursor != 0) {
            this.header.bumpCursorLimit = i << lineBits;
          }
        }
        else {
          previousLineWasUsed = false;
          this.header.lineFlags[i] = LineFlags.EMPTY;
          if (this.header.bumpCursor == 0) {
            this.header.bumpCursor = i << LineBits;
          }

          // Clear the line to recycle.
          // Memory.clearSmall(& Lines[i], LineSizeInBytes);
        }
      }

      if (this.header.bumpCursor != 0 && this.header.bumpCursorLimit == 0) {
        this.header.bumpCursorLimit = LineCount << LineBits;
      }

      this.header.state = this.header.usedLineCount === EffectiveLineCount ? BlockState.OCCUPIED :
        this.header.usedLineCount == 0 ? BlockState.FREE : BlockState.RECYCLABLE;
    }
    else {
      this.header.state = BlockState.FREE;
      //memset(&Lines[1], 0, Constants::LineSizeInBytes * (Constants::LineCount - 1));
      // Memory:: ClearSmall(& Lines[1], LineSizeInBytes * (LineCount - 1));
    }

    if (this.header.bumpCursor == 0) {
      this.header.bumpCursor = headerSizeInBytes;
    }
  }
}
