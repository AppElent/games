/**
 * The DOM hooks card animations find their way by. Tables write them with the
 * `*Attr` helpers and flights read them with the finders, so a zone name or a
 * selector lives in one place: a typo would only make a card quietly not fly.
 */
import type { CardId } from "@arcadeclub/core/cards/deck";
import type { FlightZone } from "@arcadeclub/core/cards/table-view";
import { CARD_FACE_CLASS } from "./PlayingCard";

/** Somewhere to search: the table root, an element in it, or the page. */
type Scope = Element | Document;

export type Zone = FlightZone;

export const seatZone = (seat: number): Zone => `seat-${seat}`;
export const meldZone = (meldId: number): Zone => `meld-${meldId}`;

/** A seat's disc is no card, so nothing in it gives a card's width. */
export const isSeatZone = (zone: Zone) => zone.startsWith("seat");

export const zoneAttr = (zone: Zone) => ({ "data-zone": zone });

export const cardAttr = (card: CardId) => ({ "data-card-id": card });

/** A meld the selected cards can go on; the table scrolls it into view. */
export const meldTargetAttr = { "data-target": "true" } as const;

export function findZone(root: Scope, zone: Zone) {
	return root.querySelector<HTMLElement>(`[data-zone="${zone}"]`);
}

/** The hand button holding `card`. */
export function findCard(root: Scope, card: CardId) {
	return root.querySelector<HTMLElement>(`[data-card-id="${card}"]`);
}

/** The first drawn card inside `element`, to measure a card's size. */
export function findCardFace(element: Scope) {
	return element.querySelector<HTMLElement>(`.${CARD_FACE_CLASS}`);
}

export function findMeldTarget(root: Scope) {
	return root.querySelector<HTMLElement>('.meld-area [data-target="true"]');
}
