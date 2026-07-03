export type HitsterCard = {
	id: string;
	title: string;
	artistNames: string[];
	releaseYear: number;
	releaseDatePrecision: "year";
	genreTags: string[];
	decadeTags: string[];
	previewUrl?: string;
	albumArtUrl?: string;
};

export type HitsterPack = {
	id: string;
	title: string;
	description: string;
	cards: HitsterCard[];
};

type TrackTuple = [title: string, artist: string, year: number];

function decadeTag(year: number): string {
	return `${Math.floor(year / 10) * 10}s`;
}

function buildPack(
	id: string,
	title: string,
	description: string,
	genreTags: string[],
	tracks: TrackTuple[],
): HitsterPack {
	return {
		id,
		title,
		description,
		cards: tracks.map(([trackTitle, artist, year], index) => ({
			id: `${id}-${index + 1}`,
			title: trackTitle,
			artistNames: [artist],
			releaseYear: year,
			releaseDatePrecision: "year",
			genreTags,
			decadeTags: [decadeTag(year)],
		})),
	};
}

const NORMAL_TRACKS: TrackTuple[] = [
	["Billie Jean", "Michael Jackson", 1983],
	["Like a Rolling Stone", "Bob Dylan", 1965],
	["Dancing Queen", "ABBA", 1976],
	["Rolling in the Deep", "Adele", 2010],
	["Hey Ya!", "OutKast", 2003],
	["Respect", "Aretha Franklin", 1967],
	["Superstition", "Stevie Wonder", 1972],
	["Uptown Funk", "Mark Ronson", 2014],
	["Take On Me", "a-ha", 1985],
	["Blinding Lights", "The Weeknd", 2019],
	["I Want It That Way", "Backstreet Boys", 1999],
	["Hey Jude", "The Beatles", 1968],
	["Stayin' Alive", "Bee Gees", 1977],
	["Poker Face", "Lady Gaga", 2008],
	["Get Lucky", "Daft Punk", 2013],
	["I Will Always Love You", "Whitney Houston", 1992],
	["Crazy in Love", "Beyoncé", 2003],
	["Bohemian Rhapsody", "Queen", 1975],
	["Shape of You", "Ed Sheeran", 2017],
	["Wannabe", "Spice Girls", 1996],
	["Purple Rain", "Prince", 1984],
	["Hips Don't Lie", "Shakira", 2006],
	["Rehab", "Amy Winehouse", 2006],
	["Good Vibrations", "The Beach Boys", 1966],
	["Bad Guy", "Billie Eilish", 2019],
	["Hound Dog", "Elvis Presley", 1956],
	["What's Going On", "Marvin Gaye", 1971],
	["Sweet Dreams (Are Made of This)", "Eurythmics", 1983],
	["Umbrella", "Rihanna", 2007],
	["Lose Yourself", "Eminem", 2002],
	["Johnny B. Goode", "Chuck Berry", 1958],
	["Karma Chameleon", "Culture Club", 1983],
	["Firework", "Katy Perry", 2010],
	["September", "Earth, Wind & Fire", 1978],
	["Royals", "Lorde", 2013],
	["My Girl", "The Temptations", 1964],
	["Toxic", "Britney Spears", 2003],
	["Levitating", "Dua Lipa", 2020],
	["Vogue", "Madonna", 1990],
	["Happy", "Pharrell Williams", 2013],
	["Le Freak", "Chic", 1978],
	["Chandelier", "Sia", 2014],
	["Ring of Fire", "Johnny Cash", 1963],
	["Gangnam Style", "PSY", 2012],
	["Girls Just Want to Have Fun", "Cyndi Lauper", 1983],
	["One Dance", "Drake", 2016],
	["Dancing in the Dark", "Bruce Springsteen", 1984],
	["As It Was", "Harry Styles", 2022],
];

const ROCK_TRACKS: TrackTuple[] = [
	["Smells Like Teen Spirit", "Nirvana", 1991],
	["Stairway to Heaven", "Led Zeppelin", 1971],
	["Back in Black", "AC/DC", 1980],
	["Sweet Child O' Mine", "Guns N' Roses", 1987],
	["Seven Nation Army", "The White Stripes", 2003],
	["(I Can't Get No) Satisfaction", "The Rolling Stones", 1965],
	["Hotel California", "Eagles", 1976],
	["Enter Sandman", "Metallica", 1991],
	["Born to Run", "Bruce Springsteen", 1975],
	["Mr. Brightside", "The Killers", 2004],
	["Livin' on a Prayer", "Bon Jovi", 1986],
	["Wonderwall", "Oasis", 1995],
	["American Idiot", "Green Day", 2004],
	["Paranoid", "Black Sabbath", 1970],
	["Under the Bridge", "Red Hot Chili Peppers", 1991],
	["Baba O'Riley", "The Who", 1971],
	["Do I Wanna Know?", "Arctic Monkeys", 2013],
	["Everlong", "Foo Fighters", 1997],
	["Sultans of Swing", "Dire Straits", 1978],
	["Creep", "Radiohead", 1992],
	["Black Hole Sun", "Soundgarden", 1994],
	["Should I Stay or Should I Go", "The Clash", 1982],
	["Free Bird", "Lynyrd Skynyrd", 1973],
	["Use Somebody", "Kings of Leon", 2008],
	["Purple Haze", "Jimi Hendrix", 1967],
	["Another Brick in the Wall", "Pink Floyd", 1979],
	["Barracuda", "Heart", 1977],
	["Roxanne", "The Police", 1978],
	["Zombie", "The Cranberries", 1994],
	["Song 2", "Blur", 1997],
	["More Than a Feeling", "Boston", 1976],
	["Alive", "Pearl Jam", 1991],
	["I Love Rock 'n' Roll", "Joan Jett & the Blackhearts", 1982],
	["Don't Stop Believin'", "Journey", 1981],
	["Dream On", "Aerosmith", 1973],
	["Killing in the Name", "Rage Against the Machine", 1992],
	["Where Is My Mind?", "Pixies", 1988],
	["Chop Suey!", "System of a Down", 2001],
	["In the End", "Linkin Park", 2000],
	["Take Me Out", "Franz Ferdinand", 2004],
	["Rebel Rebel", "David Bowie", 1974],
	["Fortunate Son", "Creedence Clearwater Revival", 1969],
	["The Chain", "Fleetwood Mac", 1977],
	["Last Nite", "The Strokes", 2001],
];

const NINETIES_TRACKS: TrackTuple[] = [
	["Nothing Compares 2 U", "Sinéad O'Connor", 1990],
	["U Can't Touch This", "MC Hammer", 1990],
	["Losing My Religion", "R.E.M.", 1991],
	["I'm Too Sexy", "Right Said Fred", 1991],
	["Jump Around", "House of Pain", 1992],
	["End of the Road", "Boyz II Men", 1992],
	["What Is Love", "Haddaway", 1993],
	["All That She Wants", "Ace of Base", 1992],
	["Juicy", "The Notorious B.I.G.", 1994],
	["Waterfalls", "TLC", 1994],
	["Gangsta's Paradise", "Coolio", 1995],
	["Killing Me Softly", "Fugees", 1996],
	["Macarena", "Los del Río", 1995],
	["No Diggity", "Blackstreet", 1996],
	["MMMBop", "Hanson", 1997],
	["Barbie Girl", "Aqua", 1997],
	["Torn", "Natalie Imbruglia", 1997],
	["...Baby One More Time", "Britney Spears", 1998],
	["Believe", "Cher", 1998],
	["Genie in a Bottle", "Christina Aguilera", 1999],
	["Smooth", "Santana", 1999],
	["Ice Ice Baby", "Vanilla Ice", 1990],
	["Vision of Love", "Mariah Carey", 1990],
	["Black or White", "Michael Jackson", 1991],
	["November Rain", "Guns N' Roses", 1991],
	["Rhythm Is a Dancer", "Snap!", 1992],
	["Runaway Train", "Soul Asylum", 1992],
	["Whatta Man", "Salt-N-Pepa", 1993],
	["Loser", "Beck", 1993],
	["Basket Case", "Green Day", 1994],
	["Say You'll Be There", "Spice Girls", 1996],
	["1979", "The Smashing Pumpkins", 1995],
	["Don't Speak", "No Doubt", 1995],
	["Firestarter", "The Prodigy", 1996],
	["Bitter Sweet Symphony", "The Verve", 1997],
	["Tubthumping", "Chumbawamba", 1997],
	["My Heart Will Go On", "Céline Dion", 1997],
	["Iris", "Goo Goo Dolls", 1998],
	["One Week", "Barenaked Ladies", 1998],
	["Mambo No. 5", "Lou Bega", 1999],
	["Livin' la Vida Loca", "Ricky Martin", 1999],
	["All Star", "Smash Mouth", 1999],
	["Freak on a Leash", "Korn", 1998],
	["Jump", "Kris Kross", 1992],
];

const PACKS: HitsterPack[] = [
	buildPack(
		"normal",
		"Normal",
		"A broad mix of decades and genres from the 1950s to now.",
		["pop", "mixed"],
		NORMAL_TRACKS,
	),
	buildPack(
		"rock",
		"Rock only",
		"Rock classics and anthems across six decades.",
		["rock"],
		ROCK_TRACKS,
	),
	buildPack(
		"nineties",
		"Nineties",
		"Every song released between 1990 and 1999.",
		["mixed", "90s"],
		NINETIES_TRACKS,
	),
];

export function listHitsterPacks(): HitsterPack[] {
	return PACKS;
}

export function getHitsterPack(packId: string): HitsterPack | undefined {
	return PACKS.find((pack) => pack.id === packId);
}

export function getHitsterCard(
	packId: string,
	cardId: string,
): HitsterCard | undefined {
	return getHitsterPack(packId)?.cards.find((card) => card.id === cardId);
}

/**
 * Tracks without usable audio for the selected playback mode are excluded
 * before game start. Host-device playback works for every card; preview mode
 * needs a preview URL.
 */
export function getPlayableHitsterCards(
	packId: string,
	playbackMode: "hostDevice" | "preview",
): HitsterCard[] {
	const pack = getHitsterPack(packId);
	if (!pack) {
		return [];
	}
	if (playbackMode === "preview") {
		return pack.cards.filter((card) => Boolean(card.previewUrl));
	}
	return pack.cards;
}

export function buildSpotifySearchUrl(card: HitsterCard): string {
	const query = encodeURIComponent(
		`${card.title} ${card.artistNames.join(" ")}`,
	);
	return `https://open.spotify.com/search/${query}`;
}
