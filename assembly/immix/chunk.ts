import { blockCountPerChunk, chunkSizeInBytes, blockSizeInBytes, chunkSizeInBytes } from "./consts";
import { BlockData } from "./block-data";
import { __alloc } from ".";

/**
  Header of a chunk, stored in the first @see BlockData allocated in a chunk.
*/
export class ChunkHeader {
  /**
   The offset between the address of a chunk and the raw address allocated for
   the chunk (in order to satisfy block alignment).
  */
  allocationOffset: i32;

  /**
    The number of unavailable blocks in this chunk.
  */
  blockUnavailableCount: u16;

  /**
    The number of unavailable blocks in this chunk.
  */
  blockRecyclableCount: u16;
}

/**
  A chunk contains several continous blocks in memory, aligned on a block size
  in memory.
  FIXME: unmanaged memory
*/
export class Chunk extends Uint8Array {
  header: ChunkHeader;

  constructor() {
    super(chunkSizeInBytes + blockSizeInBytes)
    // We are not using the original size of the chunk, as a chunk is a special 
    // block of memory

    // Initialize all blocks
    for (let i: u32 = 0;i < this.getBlockCount();i++) {
      this.getBlock(i).initialize();
    }
  }

  /**
    Gets the number of blocks this chunk contains.
  */
  @inline
  getBlockCount(): i32 {
    return blockCountPerChunk as i32;
  }

  /**
    Gets the block for the specified index.
    Index must be < to @see getBlockCount()
  */
  @inline
  getBlock(index: i32): BlockData {
    assert(index < this.getBlockCount());
    return changetype<BlockData>(this[index]);
  }

  @inline
  getEndOfChunk() {
    return changetype<usize>(this) + chunkSizeInBytes;
  }

  /**
    Determines whether this chunk is completely free.
  */
  @inline
  isFree(): bool {
    return this.header.blockUnavailableCount === 0 &&
      this.header.blockRecyclableCount === 0;
  }

  /**
    Determines whether this chunk contains free blocks.
  */
  @inline
  hasFreeBlocks(): bool {
    return (
      this.header.blockUnavailableCount + this.header.blockRecyclableCount
    ) < this.getBlockCount();
  }

  /**
    Determines whether this chunk contains recyclable blocks.
  */
  @inline
  hasRecyclableBlocks(): bool {
    return this.header.blockRecyclableCount > 0;
  }

}
