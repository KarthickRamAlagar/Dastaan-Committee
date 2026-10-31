import { consumeMail, createApp, type Bindings, type MailJob } from '@dastaan/core';

// The Committee API. It is the same code as the other two APIs, serving only the Committee app's routes.
const app = createApp('others');

export default {
  fetch: app.fetch,
  queue: (batch: MessageBatch<MailJob>, env: Bindings) => consumeMail(batch, env),
} satisfies ExportedHandler<Bindings, MailJob>;
