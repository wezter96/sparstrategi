import { Layer } from "effect";
import { HttpRouter } from "effect/unstable/http";
import { BunHttpServer, BunRuntime } from "@effect/platform-bun";
import { AppLayer } from "./http";

const ServerLayer = HttpRouter.serve(AppLayer).pipe(
  Layer.provide(BunHttpServer.layer({ port: Number(process.env.PORT ?? 3000) })),
);

BunRuntime.runMain(Layer.launch(ServerLayer));
