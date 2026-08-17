/**
 * The Queue's looping behavior.
 *
 * - `OFF` — advance to the next Recitation, then end when the queue is empty.
 * - `TRACK` — replay the current Recitation when it ends.
 * - `ALL` — advance to the next Recitation, wrapping back to the first when
 *   the queue ends.
 */
export enum RepeatMode {
	OFF = "off",
	TRACK = "track",
	ALL = "all",
}

export interface QueueView<T> {
	current: T | undefined;
	upcoming: T[];
	repeatMode: RepeatMode;
}

export class Queue<T> {
	private items: T[] = [];
	private _repeatMode: RepeatMode = RepeatMode.OFF;

	get repeatMode() {
		return this._repeatMode;
	}

	get size() {
		return this.items.length;
	}

	setRepeatMode(mode: RepeatMode) {
		this._repeatMode = mode;
	}

	add(item: T) {
		this.items.push(item);
	}

	/**
	 * Removes the current Recitation and makes the next one current, dropping
	 * the played item from the Queue. Unaffected by RepeatMode — used where a
	 * dead Recitation must not be replayed (e.g. an unreachable stream).
	 */
	skip() {
		this.items.shift();
	}

	/**
	 * Moves to the next Recitation per the RepeatMode. In OFF mode this drops
	 * the current item; in ALL mode the current Recitation rotates to the back
	 * so playback wraps; in TRACK mode the Queue is left unchanged so the
	 * current Recitation is replayed.
	 */
	advance() {
		switch (this._repeatMode) {
			case RepeatMode.ALL:
				if (this.items.length > 1) {
					const next = this.items.shift();
					if (next) this.items.push(next);
				}
				break;
			case RepeatMode.TRACK:
				break;
			default:
				this.items.shift();
		}
	}

	/**
	 * Removes the Recitation at the given 1-based position.
	 * @param position - 1-based position of the Recitation to remove.
	 */
	remove(position: number) {
		const index = position - 1;
		if (!this.items[index]) return false;

		this.items.splice(index, 1);
		return true;
	}

	clear() {
		this.items = [];
	}

	/** Drops every upcoming Recitation, keeping the current one playing. */
	clearPending() {
		if (this.items.length > 1) this.items = this.items.slice(0, 1);
	}

	view(): QueueView<T> {
		return {
			current: this.items[0],
			upcoming: this.items.slice(1),
			repeatMode: this._repeatMode,
		};
	}
}
