import type { WordLinkPuzzle } from "./word-links";

function puzzle(
	id: string,
	title: string,
	groups: Array<[string, "easy" | "medium" | "hard" | "tricky", string[]]>,
): WordLinkPuzzle {
	return {
		id,
		title,
		terms: groups.flatMap(([, , terms]) => terms),
		groups: groups.map(([label, difficulty, terms], index) => ({
			id: `${id}-g${index + 1}`,
			label,
			difficulty,
			terms,
		})),
	};
}

/**
 * Curated seed puzzles. Every puzzle must pass validateWordLinkPuzzle —
 * enforced by src/lib/games/__tests__/word-links.test.ts.
 */
export const WORD_LINK_PUZZLES: readonly WordLinkPuzzle[] = [
	puzzle("wl-001", "Puzzle 1", [
		["Breakfast foods", "easy", ["TOAST", "CEREAL", "PANCAKE", "OMELET"]],
		["Things with keys", "medium", ["PIANO", "KEYBOARD", "MAP", "LOCKSMITH"]],
		["___ board", "hard", ["SURF", "CHESS", "DART", "CUPBOARD"]],
		["Raise a glass", "tricky", ["CHEERS", "SALUTE", "PROSIT", "SKOL"]],
	]),
	puzzle("wl-002", "Puzzle 2", [
		["Weather", "easy", ["RAIN", "SNOW", "HAIL", "FOG"]],
		["Coins", "medium", ["PENNY", "NICKEL", "DIME", "QUARTER"]],
		["Shades of blue", "hard", ["NAVY", "TEAL", "AZURE", "COBALT"]],
		["Words before 'storm'", "tricky", ["BRAIN", "THUNDER", "SAND", "FIRE"]],
	]),
	puzzle("wl-003", "Puzzle 3", [
		["String instruments", "easy", ["VIOLIN", "CELLO", "HARP", "BANJO"]],
		["Types of bread", "medium", ["RYE", "PITA", "BAGUETTE", "SOURDOUGH"]],
		["Card games", "hard", ["BRIDGE", "HEARTS", "SPIT", "RUMMY"]],
		["Body of water + letter", "tricky", ["BAYS", "SEAS", "LAKES", "PONDS"]],
	]),
	puzzle("wl-004", "Puzzle 4", [
		["Farm animals", "easy", ["COW", "PIG", "HEN", "GOAT"]],
		["Chess pieces", "medium", ["ROOK", "KNIGHT", "BISHOP", "PAWN"]],
		["Ballroom dances", "hard", ["WALTZ", "TANGO", "FOXTROT", "RUMBA"]],
		["___ fish", "tricky", ["SWORD", "CAT", "JELLY", "STAR"]],
	]),
	puzzle("wl-005", "Puzzle 5", [
		["Citrus fruits", "easy", ["LEMON", "LIME", "ORANGE", "GRAPEFRUIT"]],
		["Tools", "medium", ["HAMMER", "WRENCH", "PLIERS", "CHISEL"]],
		["Sleep-related", "hard", ["DOZE", "NAP", "SNOOZE", "SLUMBER"]],
		["___ pepper", "tricky", ["BELL", "CHILI", "BLACK", "GHOST"]],
	]),
	puzzle("wl-006", "Puzzle 6", [
		["Planets", "easy", ["MARS", "VENUS", "SATURN", "NEPTUNE"]],
		["Herbs", "medium", ["BASIL", "THYME", "SAGE", "MINT"]],
		["Boxing terms", "hard", ["JAB", "HOOK", "CORNER", "BOUT"]],
		["Roman gods", "tricky", ["JUPITER", "MERCURY", "APOLLO", "VULCAN"]],
	]),
	puzzle("wl-007", "Puzzle 7", [
		["Yoga-adjacent", "easy", ["POSE", "MAT", "STRETCH", "BREATH"]],
		["Detective words", "medium", ["CLUE", "SUSPECT", "ALIBI", "MOTIVE"]],
		["Knots", "hard", ["BOWLINE", "HITCH", "SQUARE", "GRANNY"]],
		["___ house", "tricky", ["LIGHT", "GREEN", "DOG", "WARE"]],
	]),
	puzzle("wl-008", "Puzzle 8", [
		["Desserts", "easy", ["CAKE", "PIE", "PUDDING", "MOUSSE"]],
		["Dog breeds", "medium", ["POODLE", "BEAGLE", "HUSKY", "BOXER"]],
		["Poker terms", "hard", ["FOLD", "BLUFF", "RIVER", "FLOP"]],
		["Homophones of numbers", "tricky", ["WON", "TOO", "ATE", "FOR"]],
	]),
	puzzle("wl-009", "Puzzle 9", [
		["Ocean creatures", "easy", ["WHALE", "DOLPHIN", "OCTOPUS", "SEAL"]],
		["Fabrics", "medium", ["SILK", "DENIM", "WOOL", "LINEN"]],
		["Golf terms", "hard", ["BIRDIE", "BOGEY", "CADDIE", "FAIRWAY"]],
		["Things that pop", "tricky", ["CORK", "BALLOON", "QUIZ", "CORN"]],
	]),
	puzzle("wl-010", "Puzzle 10", [
		["Hot drinks", "easy", ["COFFEE", "TEA", "COCOA", "CIDER"]],
		["Gemstones", "medium", ["RUBY", "OPAL", "TOPAZ", "GARNET"]],
		["Theater words", "hard", ["STAGE", "CURTAIN", "PROP", "WINGS"]],
		["Famous Isaacs", "tricky", ["NEWTON", "ASIMOV", "HAYES", "SINGER"]],
	]),
	puzzle("wl-011", "Puzzle 11", [
		["Vegetables", "easy", ["CARROT", "PEA", "ONION", "SPINACH"]],
		["Units of time", "medium", ["MINUTE", "FORTNIGHT", "DECADE", "ERA"]],
		["Sailing terms", "hard", ["MAST", "KEEL", "RUDDER", "BOOM"]],
		["___ walk", "tricky", ["MOON", "BOARD", "SIDE", "CAKE"]],
	]),
	puzzle("wl-012", "Puzzle 12", [
		["Birds", "easy", ["ROBIN", "SPARROW", "FINCH", "WREN"]],
		["Baking needs", "medium", ["FLOUR", "YEAST", "SUGAR", "BUTTER"]],
		["Castle features", "hard", ["MOAT", "TURRET", "DRAWBRIDGE", "KEEP"]],
		["Playing-card slang", "tricky", ["JOKER", "ACE", "DEUCE", "FACE"]],
	]),
	puzzle("wl-013", "Puzzle 13", [
		["Pizza toppings", "easy", ["PEPPERONI", "MUSHROOM", "OLIVE", "HAM"]],
		["Rivers", "medium", ["NILE", "AMAZON", "DANUBE", "RHINE"]],
		["Bowling terms", "hard", ["STRIKE", "SPARE", "GUTTER", "LANE"]],
		["___ market", "tricky", ["STOCK", "FLEA", "SUPER", "BLACK"]],
	]),
	puzzle("wl-014", "Puzzle 14", [
		["Emotions", "easy", ["JOY", "ANGER", "FEAR", "PRIDE"]],
		["Kitchen appliances", "medium", ["BLENDER", "TOASTER", "KETTLE", "MIXER"]],
		["Types of poems", "hard", ["SONNET", "HAIKU", "LIMERICK", "ODE"]],
		[
			"Anagram pairs of 'listen'",
			"tricky",
			["SILENT", "TINSEL", "ENLIST", "INLETS"],
		],
	]),
	puzzle("wl-015", "Puzzle 15", [
		["Winter gear", "easy", ["SCARF", "MITTENS", "PARKA", "EARMUFFS"]],
		["Circus acts", "medium", ["JUGGLER", "ACROBAT", "CLOWN", "TRAPEZE"]],
		["Coffee orders", "hard", ["LATTE", "MOCHA", "ESPRESSO", "CORTADO"]],
		["___ berg/burg", "tricky", ["ICE", "HAMBURG", "PITTSBURGH", "STRASBOURG"]],
	]),
	puzzle("wl-016", "Puzzle 16", [
		["Reptiles", "easy", ["SNAKE", "LIZARD", "TURTLE", "GECKO"]],
		["Hats", "medium", ["BERET", "FEDORA", "BEANIE", "SOMBRERO"]],
		[
			"Ways to cook eggs",
			"hard",
			["POACHED", "SCRAMBLED", "DEVILED", "CODDLED"],
		],
		["Film genres", "tricky", ["HORROR", "DRAMA", "ACTION", "COMEDY"]],
	]),
	puzzle("wl-017", "Puzzle 17", [
		["School subjects", "easy", ["MATH", "HISTORY", "BIOLOGY", "ART"]],
		["Nuts", "medium", ["ALMOND", "CASHEW", "PECAN", "WALNUT"]],
		["Fencing terms", "hard", ["PARRY", "LUNGE", "RIPOSTE", "TOUCHE"]],
		["___ trip", "tricky", ["ROAD", "GUILT", "FIELD", "ROUND"]],
	]),
	puzzle("wl-018", "Puzzle 18", [
		["Garden flowers", "easy", ["ROSE", "TULIP", "DAISY", "PEONY"]],
		["Currencies", "medium", ["EURO", "YEN", "RUPEE", "KRONA"]],
		["Climbing terms", "hard", ["BELAY", "CRIMP", "RAPPEL", "CARABINER"]],
		[
			"Girls' names in songs",
			"tricky",
			["JUDE", "RHIANNON", "LAYLA", "JOLENE"],
		],
	]),
	puzzle("wl-019", "Puzzle 19", [
		["Sandwich fillings", "easy", ["TUNA", "CHEESE", "TURKEY", "EGG"]],
		["Constellations", "medium", ["ORION", "LYRA", "DRACO", "PEGASUS"]],
		["Sewing terms", "hard", ["HEM", "SEAM", "BASTE", "PLEAT"]],
		["___ band", "tricky", ["RUBBER", "HEAD", "WRIST", "BROAD"]],
	]),
	puzzle("wl-020", "Puzzle 20", [
		["Camping gear", "easy", ["TENT", "LANTERN", "COMPASS", "SLEEPING BAG"]],
		["Cheeses", "medium", ["BRIE", "GOUDA", "FETA", "MANCHEGO"]],
		["Typography terms", "hard", ["SERIF", "KERNING", "GLYPH", "LIGATURE"]],
		["Silent-K words", "tricky", ["KNEE", "KNIGHT", "KNOT", "KNACK"]],
	]),
];

export function getWordLinkPuzzleById(id: string) {
	return WORD_LINK_PUZZLES.find((candidate) => candidate.id === id);
}
