export function deserialize(schema, fieldType, data) {
  const reader = new BinaryReader(data);

  if (fieldType === 'u8') {
    return reader.read_u8();
  } else if (fieldType === 'u64') {
    return reader.read_u64();
  } else if (fieldType === 'u128') {
    return reader.read_u128();
  } else if (fieldType === 'bool') {
    return !!reader.read_u8();
  } else if (fieldType === 'string') {
    return reader.read_string();
  } else if (fieldType instanceof Array) {
    if (typeof fieldType[0] === 'number') {
      return reader.read_fixed_array(fieldType[0]);
    } else {
      return reader.read_array(() => deserialize(schema, fieldType[0], reader));
    }
  } else {
    const structSchema = schema[fieldType];
    console.log(structSchema);

    if (!structSchema) {
      throw new Error(`Schema type ${fieldType} is missing in schema`);
    }
    if (structSchema.kind === 'option') {
      const optionRes = reader.read_u8();
      if (optionRes === 0) {
        return null;
      } else if (optionRes === 1) {
        return deserialize(schema, structSchema.type, reader);
      } else {
        throw new Error(`Unexpected option flag: ${optionRes}`);
      }
    } else if (structSchema.kind === 'struct') {
      const result = {};
      for (const [fieldName, fieldType] of structSchema.fields) {
        result[fieldName] = deserialize(schema, fieldType, reader);
      }
      return result;
    } else if (structSchema.kind === 'function') {
      return structSchema.deser(reader, schema);
    } else {
      throw new Error(
        `Unexpected schema kind: ${structSchema.kind} for ${fieldType}`,
      );
    }
  }
}

class BinaryReader {
  constructor(buf) {
    this.buf = buf;
    this.offset = 0;
  }

  read_u8() {
    const value = this.buf.buf.readUInt8(this.offset);
    this.offset += 1;
    return value;
  }

  read_u32() {
    if (this.buf.buf) {
      const value = this.buf.buf.readUInt32LE(this.offset);
      this.offset += 4;
      return value;
    } else {
      const value = this.buf.readUInt32LE(this.offset);
      this.offset += 4;
      return value;
    }
  }

  read_u64() {
    const buf = this.read_buffer(8);
    return new BN(buf, 'le');
  }

  read_u128() {
    const buf = this.read_buffer(16);
    return new BN(buf, 'le');
  }

  read_buffer(len) {
    if (this.offset + len > this.buf.length) {
      console.log(`Expected buffer length ${len} isn't within bounds`);
    }
    const result = this.buf.slice(this.offset, this.offset + len);
    this.offset += len;
    return result;
  }

  read_string() {
    const len = this.read_u32();
    const buf = this.read_buffer(len);
    // @ts-ignore
    const textDecoder = TextDecoder();
    try {
      // NOTE: Using TextDecoder to fail on invalid UTF-8
      return textDecoder.decode(buf);
    } catch (e) {
      console.log(`Error decoding UTF-8 string: ${e}`);
    }
  }

  read_fixed_array(len) {
    return new Uint8Array(this.read_buffer(len));
  }

  read_array(fn) {
    const len = this.read_u32();
    const result = [];
    for (let i = 0; i < len; ++i) {
      result.push(fn());
    }
    return result;
  }
}
