import {
	JOIN_CODE_ALPHABET,
	JOIN_CODE_LENGTH,
} from "@arcadeclub/core/sessions";

export function makeJoinCode() {
	let code = "";
	for (let index = 0; index < JOIN_CODE_LENGTH; index += 1) {
		code +=
			JOIN_CODE_ALPHABET[Math.floor(Math.random() * JOIN_CODE_ALPHABET.length)];
	}
	return code;
}

export function makeShareToken() {
	return `share_${crypto.randomUUID().replace(/-/g, "")}`;
}
