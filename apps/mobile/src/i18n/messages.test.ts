import { assertMessageParity } from "../test-support/message-parity";
import { en } from "./messages/en";
import { nl } from "./messages/nl";

assertMessageParity({ en, nl });
