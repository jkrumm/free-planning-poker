import { describe, expect, test } from 'bun:test'
import { readDump, type DumpValue } from './dump.ts'

const FIXTURE = new URL('../../../test/import/v1-fixture.sql', import.meta.url).pathname

/** A string as a stream cut into pieces of `size` characters, so every state of the splitter meets a chunk edge. */
function chunked(text: string, size: number): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text)
  let at = 0
  return new ReadableStream({
    pull(controller) {
      if (at >= bytes.length) return controller.close()
      controller.enqueue(bytes.subarray(at, at + size))
      at += size
    },
  })
}

async function rooms(text: string, size = 1 << 16) {
  const rows: DumpValue[][] = []
  const summary = await readDump(chunked(text, size), {
    fpp_rooms: { columns: ['name', 'id'], row: (values) => rows.push([...values]) },
  })
  return { rows, summary }
}

describe('readDump', () => {
  test("reads a real mariadb-dump's rows in the asked column order, escapes undone", async () => {
    const { rows, summary } = await rooms(await Bun.file(FIXTURE).text())
    expect(summary.rows).toEqual({ fpp_rooms: 13 })
    expect(rows[0]).toEqual(['123456', '1'])
    expect(rows[10]).toEqual(["o'neil\\x", '11'])
    expect(rows[11]).toEqual(['🚀 rockets', '12'])
  })

  test('the same rows whatever the chunk size, a byte at a time included', async () => {
    const text = await Bun.file(FIXTURE).text()
    const whole = await rooms(text)
    for (const size of [1, 2, 3, 7, 64]) expect((await rooms(text, size)).rows).toEqual(whole.rows)
  })

  test('a table not asked for is not read, NULL is null, an INSERT with a column list is read by it', async () => {
    const text = [
      "/*!40103 SET TIME_ZONE='+00:00' */;",
      '-- a comment; with a semicolon',
      'CREATE TABLE `fpp_rooms` (\n  `id` int(11) NOT NULL,\n  `name` varchar(15) NOT NULL,\n  PRIMARY KEY (`id`)\n) ENGINE=InnoDB;',
      "INSERT INTO `fpp_users` VALUES ('x','a;b');",
      "INSERT INTO `fpp_rooms` (`name`, `id`) VALUES ('a''b', 7),(NULL,8);",
    ].join('\n')
    expect((await rooms(text)).rows).toEqual([
      ["a'b", '7'],
      [null, '8'],
    ])
  })

  test('refuses a dump not written in UTC, and one without a table asked for', async () => {
    const local =
      "CREATE TABLE `fpp_rooms` (\n  `id` int,\n  `name` text\n);\nINSERT INTO `fpp_rooms` VALUES (1,'a');"
    await expect(rooms(local)).rejects.toThrow('not in UTC')
    await expect(rooms("/*!40103 SET TIME_ZONE='+00:00' */;")).rejects.toThrow('no table fpp_rooms')
  })
})
