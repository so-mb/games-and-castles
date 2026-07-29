import { stdin, stdout } from "node:process";

export async function promptSecret(label) {
  if (!stdin.isTTY || !stdout.isTTY)
    throw new Error("A TTY is required for the hidden passphrase prompt.");
  stdout.write(label);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");
  let value = "";
  try {
    return await new Promise((resolve, reject) => {
      const receive = (chunk) => {
        for (const character of chunk) {
          if (character === "\r" || character === "\n") {
            stdin.removeListener("data", receive);
            stdout.write("\n");
            resolve(value);
            return;
          }
          if (character === "\u0003") {
            stdin.removeListener("data", receive);
            reject(new Error("Cancelled."));
            return;
          }
          if (character === "\u007f") value = value.slice(0, -1);
          else value += character;
        }
      };
      stdin.on("data", receive);
    });
  } finally {
    stdin.setRawMode(false);
    stdin.pause();
  }
}
