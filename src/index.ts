import { createApp } from "./app";

const PORT = Number(process.env.PORT ?? 4000);

createApp().listen(PORT, () => console.log(`api-gateway escuchando en http://localhost:${PORT}`));
