import { OPT_TTYPE, Server } from "./index";
import { TEST_SERVER_PORT } from "./src/constants";

const server = Server((connection) => {
  let width = 0;
  let height = 0;
  if (connection.windowSize !== undefined) {
    [width, height] = connection.windowSize;
  }

  console.log(
    "connected; term=%s %dx%d",
    connection.term,
    width,
    height,
  );
  console.log(connection.env);

  connection.on("data", (buffer: Buffer) => {
    console.log("data:", buffer.toString("ascii"));
    connection.write(`you said ${buffer.toString("ascii")}`);
  });
  connection.on("negotiated", (code: number, buffer: Buffer) => {
    if (code === OPT_TTYPE) {
      console.log("TERM=%s", connection.term);
    }
    console.log("negotiated", code, buffer.toString("ascii"));
  });
  connection.on("resize", (resizeWidth: number, resizeHeight: number) => {
    console.log("window size is %d x %d", resizeWidth, resizeHeight);
  });
  connection.on("interrupt", () => {
    console.log("INTR!");
    connection.end();
  });
  connection.on("wont", (option: number) => {
    console.log("WONT", option);
  });
  connection.on("will", (option: number) => {
    console.log("WILL", option);
  });
  connection.on("close", () => {
    console.log("END!");
  });

  connection.write("Hello!> ");
});

server.listen(TEST_SERVER_PORT);
