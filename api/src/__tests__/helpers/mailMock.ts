import { SMTPServer } from 'smtp-server';
import { simpleParser, type ParsedMail } from 'mailparser';

export class MailMockServer {
  private server: SMTPServer;
  public emails: ParsedMail[] = [];

  constructor(private port: number = 1025) {
    this.server = new SMTPServer({
      authOptional: true,
      onData: (stream, _session, callback) => {
        simpleParser(stream, (err, mail) => {
          if (!err) this.emails.push(mail);
          callback();
        });
      },
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.port, () => resolve());
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => resolve());
    });
  }

  clear(): void {
    this.emails = [];
  }

  get lastEmail(): ParsedMail | undefined {
    return this.emails[this.emails.length - 1];
  }
}
