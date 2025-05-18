# Appwrite Schema Bootstrapper

## Motivation

When starting a new Appwrite project, building a database by manually defining 
collections and attributes in the console is tedious and slows down rapid prototyping. 

This toolkit lets you define a data model based on sample data in plain old JSON.

By examining the JSON data, we can first infer collections and attributes, to build what
is called a "platform-agnostic schema". This is thought of as a schema that isn't specific
to any type of cloud platform or database. It is a generic representation of the data model.

We can use platform-agnostic schema, to guide the generation of Appwrite collections
and attributes. This way, we can avoid the tedious manual setup in the Appwrite console.

The toolkit is designed to be used in conjunction with the Appwrite CLI, which allows
you to push and pull your project configuration.

The toolkit is not meant to be a replacement for the Appwrite console, but rather a
tool to help you get started quickly and easily.

This project is a work in progress, and we are looking for contributors to help push 
it in the right direction, making as valuable as possible for the whole Appwrite community.

**Note**: The project is very easy to work with locally if you use VSCODE. There is a devcontainer
available, which will set up a local development environment, including Deno. You can use the devcontainer
to run the toolkit and test your changes with your own Appwrite container, without affecting your main Appwrite project.

## Quick Start

### 1. Use the CLI to get your Appwrite configuration

Get yourself logged in and ready to setup your project details:

`appwrite login`
? Enter your email 

? Enter your password

♥ Hint: Next you can create or link to your project using 'appwrite init project'


Connect to your Appwrite project:
`appwrite init project`


? How would you like to start? Link directory to an existing project

? Choose your organization <ID>

? Choose your Appwrite project. <ID>>

✓ Success: Project successfully linked. Details are now stored in appwrite.json file.

? Would you like to pull all resources from project you just linked? **Yes**

ℹ Info: Pulling project settings ...

✓ Success: Successfully pulled all project settings.

ℹ Info: Fetching functions ...

ℹ Info: No functions found.

✓ Success: Successfully pulled 0 functions.

ℹ Info: Fetching collections ...

ℹ Info: Pulling all collections from bloxez database ...

✓ Success: Successfully pulled 1 collections.

ℹ Info: Fetching buckets ...

ℹ Info: No buckets found.

✓ Success: Successfully pulled 0 buckets.

ℹ Info: Fetching teams ...

✓ Success: Successfully pulled 0 teams.

ℹ Info: Fetching topics ...

ℹ Info: No topics found.

✓ Success: Successfully pulled 0 topics.


♥ Hint: Next you can use 'appwrite init' to create resources in your project, or use 'appwrite pull' and 'appwrite push' to synchronize your project.

### 2. Run the test with Deno

You can run and debug the tests to learn in detail how the process works, or just simply run the test
and let it complete, as it will create a new configuration in `appwrite-updated.json` under the test folder.

### 3. Describe Your Own Data in JSON

Create a sample data file (e.g., `test/demo.json`):

```json
{
  "customer": [
    {
      "id": "1",
      "name": "John Doe",
      "email": "john.doe@example.com",
      "order": [
        {
          "id": 1,
          "product": "cream",
          "price": 1.50
        }
      ],
      "coupon": {
        "10_off": {
          "customerId": "1",
          "id": "10_off",
          "description": "10% off"
        },
        "20_off": {
          "customerId": "1",
          "id": "20_off",
          "description": "20% off this month"
        }
      }
    },
    {
      "id": "2",
      "name": "Jane Smith",
      "email": "jane.smith@example.com",
      "order": [
        {
          "id": 2,
          "product": "lotion",
          "price": 2.00
        }
      ],
      "coupon": {
        "5_off": {
          "customerId": "2",
          "id": "5_off",
          "description": "5% off"
        },
        "25_off": {
          "customerId": "2",
          "id": "25_off",
          "description": "25% off first order"
        }
      }
    }
  ]
}
```

### 4. Create a Merge Configuration

The idea of the merge configuration is to define how the data should be interpreted in order to create
sensible collections.

Referring to the example above, we can define a merge configuration like this:

```json
{
  "root": "root",
  "documents": [
    "customer",
    "order",
    "coupon"
  ]
}
```

The `root` property catches any stray attribtes in at the top level of the JSON data, and gives a collection
name of "root". Normally, you wouldn't have attributes at the same level as the collections, but this is a
safety net in case you do.

The `documents` property is an array of names for the collections that should be created by inferring the attributes and types from nested objects which can be specified as an array of objects, or dictionary. Refer to the orders and coupons in the example above. 

The `customer` collection will contain the `id`, `name`, and `email` attributes, while the `order` collection will contain the `id`, `product`, and `price` attributes. The `coupon` collection will contain the `customerId`, `id`, and `description` attributes.

All of this is just magically inferred from the JSON data guided by the `documents` attribute in the merge configuration.

#### Extended merge

We don't have a detailed description of `merge` and `merge_chidren` yet, as they may be nasty hacks. But you will see them mentioned in the code.

The idea of `merge` is to say that an object nested within object should have its fields merged into the parent. This is because Appwrite does not support attribute types of JSON. So you would have to create an address collection. Creating the schema with the `merge` strategy might just be a simple way to get around this, without having to stringify and parse JSON from a string field, though that would also be a valid approach.

```json
{
    "customer": [{
        "id": "1",
        "name": "John Doe",
        "address": {
            "street": "123 Main St",
            "city": "New York",
            "state": "NY"
        }
    }]
}
```

Specifying address in the `merge` array will merge the fields of address into the customer prefixing each with `$json.address.fieldname`. This way when you retrieve the document, you could look at the field names and recreate the nested address object structure.


### 5. Generate a Platform-Agnostic Schema

```typescript
import AutoSchemaBuilder from './seed/AutoSchemaBuilder.ts';

const rawData = /* load from demo.json */;
const mergeConfig = {
  root: "root",
  merge: [],
  merge_children: [],
  documents: ["customer", "order", "coupon"]
};

const schemaBuilder = new AutoSchemaBuilder(rawData, mergeConfig);
const schema = schemaBuilder.generate(); // { fields, collections }
```

### 4. Generate Appwrite Collections

```typescript
import AppwriteCollectionsBuilder from "./seed/AppwriteCollectionsBuilder.ts";
import appwriteConfig from "./test/appwrite.json" assert { type: "json" };

const generator = new AppwriteCollectionsBuilder(appwriteConfig, schema);
const updatedConfig = generator.generateCollections();

// Save to file for use with Appwrite CLI
import { writeTextFile } from "https://deno.land/std/fs/mod.ts";
await writeTextFile(
  "./test/appwrite-updated.json",
  JSON.stringify(updatedConfig, null, 2),
);
```

### 5. Review and Push Collections to Appwrite

Carefully review the generated collections in `appwrite-updated.json` to ensure
all attributes and types are correct. Make any manual adjustments if needed.

Then, use the Appwrite CLI to push just the collections configuration back to
the cloud:

```bash
appwrite push --target collections --file ./test/appwrite-updated.json
```

## Summary

This toolkit lets you:

- Start with just your sample data.
- Instantly generate a matching Appwrite schema.
- Avoid manual setups in the Appwrite console.
- Iterate and evolve your schema as your project grows.

**Get started by describing your data in JSON, and let the toolkit do the
rest!**

## Next Ideas

- At the moment we're working on building the collections and next we have to create the relationships between collections.

- Once we have the schema generated and uploaded into Appwrite, we should be able to automatically load the sample data.
