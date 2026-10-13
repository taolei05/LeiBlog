import { describe, expect, spyOn, test } from "bun:test";

import AdmZip from "adm-zip";

import {
  BACKUP_LIMITS,
  BackupError,
  readBackupEntry,
  readBackupZip,
  validateBackupZip,
} from "./archive";

const toFile = (zip: AdmZip) => new File([new Uint8Array(zip.toBuffer())], "backup.zip");

describe("bounded backup archives", () => {
  test("round-trips a valid compressed entry", async () => {
    const zip = new AdmZip();
    zip.addFile("data.json", Buffer.from('{"ok":true}'));
    const parsed = await readBackupZip(toFile(zip));
    const entry = parsed.getEntry("data.json");
    if (entry === null) throw new Error("Missing fixture entry");
    expect(readBackupEntry(entry).toString()).toBe('{"ok":true}');
  });

  test("rejects large uploads before reading the file into memory", async () => {
    const file = new File(["fixture"], "backup.zip");
    Object.defineProperty(file, "size", { value: BACKUP_LIMITS.archiveBytes + 1 });
    const read = spyOn(file, "arrayBuffer");
    await expect(readBackupZip(file)).rejects.toBeInstanceOf(BackupError);
    expect(read).not.toHaveBeenCalled();
    read.mockRestore();
  });

  test("rejects empty or malformed archives", async () => {
    await expect(readBackupZip(new File([], "backup.zip"))).rejects.toBeInstanceOf(BackupError);
    await expect(readBackupZip(new File(["invalid"], "backup.zip"))).rejects.toBeInstanceOf(
      BackupError,
    );
  });

  test.each(["../file.txt", "/file.txt", "media/../../file.txt", "media\\file.txt", "C:/file.txt"])(
    "rejects archive traversal %s",
    (name) => {
      const zip = new AdmZip();
      zip.addFile("safe.txt", Buffer.from("fixture")).entryName = name;
      expect(() => validateBackupZip(zip)).toThrow(BackupError);
    },
  );

  test("rejects duplicate names, encrypted entries, and symbolic links", () => {
    const duplicate = new AdmZip();
    duplicate.addFile("a.txt", Buffer.from("a"));
    duplicate.addFile("b.txt", Buffer.from("b"));
    duplicate.getEntries()[1].entryName = "a.txt";
    expect(() => validateBackupZip(duplicate)).toThrow(BackupError);
    const encrypted = new AdmZip();
    encrypted.addFile("a.txt", Buffer.from("a")).header.flags |= 1;
    expect(() => validateBackupZip(encrypted)).toThrow(BackupError);
    const symlink = new AdmZip();
    symlink.addFile("a.txt", Buffer.from("../outside")).header.attr = (0xa000 << 16) >>> 0;
    expect(() => validateBackupZip(symlink)).toThrow(BackupError);
  });

  test("rejects expanded per-file, JSON, count, and total limits before decompression", () => {
    const oversized = new AdmZip();
    oversized.addFile("a.txt", Buffer.from("a")).header.size = BACKUP_LIMITS.entryBytes + 1;
    expect(() => validateBackupZip(oversized)).toThrow(BackupError);
    const json = new AdmZip();
    json.addFile("data.json", Buffer.from("{}")).header.size = BACKUP_LIMITS.jsonBytes + 1;
    expect(() => validateBackupZip(json)).toThrow(BackupError);
    const many = new AdmZip();
    const count = spyOn(many, "getEntryCount").mockReturnValue(BACKUP_LIMITS.entries + 1);
    expect(() => validateBackupZip(many)).toThrow(BackupError);
    count.mockRestore();
    const total = new AdmZip();
    for (let index = 0; index < 5; index += 1) {
      total.addFile(`${index}.txt`, Buffer.from("a")).header.size = BACKUP_LIMITS.entryBytes;
    }
    expect(() => validateBackupZip(total)).toThrow(BackupError);
  });

  test("bounds actual decompression when the size in the ZIP header is forged", async () => {
    const zip = new AdmZip();
    zip.addFile("bomb.txt", Buffer.alloc(1024 * 1024, 65));
    const bytes = zip.toBuffer();
    const central = bytes.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    bytes.writeUInt32LE(8, central + 24);
    bytes.writeUInt32LE(8, 22);
    const parsed = await readBackupZip(new File([new Uint8Array(bytes)], "bomb.zip"));
    const entry = parsed.getEntry("bomb.txt");
    if (entry === null) throw new Error("Missing fixture entry");
    expect(() => readBackupEntry(entry)).toThrow(BackupError);
  });

  test("rejects CRC corruption", async () => {
    const zip = new AdmZip();
    zip.addFile("data.json", Buffer.from("{}"));
    const parsed = await readBackupZip(toFile(zip));
    const entry = parsed.getEntry("data.json");
    if (entry === null) throw new Error("Missing fixture entry");
    entry.header.crc ^= 1;
    expect(() => readBackupEntry(entry)).toThrow(BackupError);
  });
});
