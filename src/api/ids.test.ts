import { newIdempotencyKey, randomHex } from "./ids";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const stubBytes = (value: number) =>
	vi.spyOn(crypto, "getRandomValues").mockImplementation(<T extends ArrayBufferView | null>(array: T): T => {
		(array as unknown as Uint8Array).fill(value);
		return array;
	});

afterEach(() => vi.restoreAllMocks());

describe("newIdempotencyKey", () => {
	it("is a UUID v4 and differs every call", () => {
		const keys = new Set(Array.from({ length: 50 }, newIdempotencyKey));
		expect(keys.size).toBe(50);
		for (const key of keys) expect(key).toMatch(UUID_V4);
	});

	it("takes 128 random bits from getRandomValues and sets the version and variant bits", () => {
		const spy = stubBytes(0xff);
		expect(newIdempotencyKey()).toBe("ffffffff-ffff-4fff-bfff-ffffffffffff");
		expect(spy).toHaveBeenCalledWith(expect.objectContaining({ length: 16 }));
		stubBytes(0x00);
		expect(newIdempotencyKey()).toBe("00000000-0000-4000-8000-000000000000");
	});

	it("never touches Math.random or randomUUID", () => {
		const random = vi.spyOn(Math, "random");
		const uuid = vi.spyOn(crypto, "randomUUID");
		newIdempotencyKey();
		randomHex(4);
		expect(random).not.toHaveBeenCalled();
		expect(uuid).not.toHaveBeenCalled();
	});
});

describe("randomHex", () => {
	it("returns two lowercase hex characters per byte", () => {
		expect(randomHex(4)).toMatch(/^[0-9a-f]{8}$/);
		expect(randomHex(0)).toBe("");
	});
});
