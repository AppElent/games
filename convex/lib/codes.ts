const JOIN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function makeJoinCode(length = 6) {
	let code = "";
	for (let index = 0; index < length; index += 1) {
		code += JOIN_ALPHABET[Math.floor(Math.random() * JOIN_ALPHABET.length)];
	}
	return code;
}

export function makeShareToken() {
	return `share_${crypto.randomUUID().replace(/-/g, "")}`;
}
