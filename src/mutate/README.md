We ESLint as an example cse but the hope is to make this work for any type sorcd

json.schema, ts types, and zod

zod will be what we normalize to and we want to create validators. for now if
things fail lets add it to a log and look at it after this project talks about
an eslint config but lets target our project root deno.json for out example case

ESLint Config Schema – JSON Schema, TypeScript, and Zod Representations

Canonical ESLint Config Schema (JSON Schema Structure)

ESLint’s configuration (using the legacy eslintrc format) is a JSON-like object
with a well-defined schema. At the top level, the config object can include
properties such as extends, env, globals, parser, parserOptions, plugins, rules,
settings, overrides, ignorePatterns, and root, among others. Each of these has a
specific type or structure: •	extends – A string or an array of strings
specifying base configurations to extend. Each entry can be an ESLint shareable
config name, "eslint:recommended", "eslint:all", a plugin config
("plugin:<plugin>/<config>"), or a path to a config file ￼. For example, you
might have "extends": ["eslint:recommended",
"plugin:@typescript-eslint/recommended"] ￼. •	env – An object mapping
environment names to boolean values (enable/disable that environment’s globals).
For example: "env": { "browser": true, "node": false } ￼. •	globals – An object
mapping global variable names to a string or boolean flag indicating if they are
allowed. Traditionally, false (or "readonly") means a read-only global and true
(or "writable") means it can be overwritten ￼. For instance: "globals": {
"React": "readonly", "MY_VAR": true }. •	parser – A string naming a parser
package (e.g. "@typescript-eslint/parser" ￼) if not using ESLint’s default.
•	parserOptions – An object with parser configuration, such as ecmaVersion
(number or "latest"), sourceType ("module" or "script"), ecmaFeatures (object of
boolean experimental language features), or parser-specific options (for
example, TypeScript parser accepts a project path to tsconfig) ￼. •	plugins – An
array of plugin names to load. For example: "plugins": ["@typescript-eslint"] ￼.
•	rules – An object mapping rule names to rule settings. Rule names can include
plugin prefixes (e.g. "@typescript-eslint/strict-boolean-expressions"). The
value can be: •	a severity level: numeric 0, 1, 2 or string “off”, “warn”,
“error” ￼ ￼, •	or an array where the first element is the severity and
subsequent elements are rule-specific options ￼. For example:

"rules": { "eqeqeq": "warn", "strict": "off", "semi": ["error", "never"] }

In this example, the rule semi is turned on as an error with an option "never"
(to disallow semicolons) ￼.

    •	settings – Arbitrary object for plugin-specific settings. For example: "settings": { "sharedData": "Hello" } ￼.
    •	ignorePatterns – String or array of glob patterns to ignore (in addition to .eslintignore).
    •	overrides – An array of conditional configuration objects that apply on certain files. Each override object must include a files pattern (string or array of globs) to match, and can include any of the config fields above (except root). For example, you might override settings for test files or TypeScript files. An override entry may look like:

"overrides": [ { "files": ["src/**/*"], "rules": { "semi": ["warn", "always"] }
}, { "files": ["test/**/*"], "rules": { "no-console": "off" } } ]

This defines different rule settings for files in src vs test directories ￼.
Overrides can also specify their own parser, plugins, extends, etc., which will
be merged in for matching files ￼ ￼.

    •	root – A boolean. If set to true, ESLint stops looking for other config files above the location of this file (prevents cascading beyond this point) ￼.

JSON Schema Representation: In JSON Schema (Draft-07 or later) these would be
captured with object properties and definitions. For example, the JSON Schema
might define extends as: oneOf: [{ "type":"string" }, { "type":"array", "items":
{ "type":"string" } }] to allow a string or array of strings. Many fields are
optional, so they’d be marked that way or simply not required in the schema. The
rules object in a JSON Schema can be tricky: rule names are not fixed
(especially with plugins), so schemas often use pattern-based or additional
properties. A common approach is to allow any key in "rules" and enforce the
value to match the “rule severity or [severity, …]” pattern. For instance, the
schema might use a patternProperties or definition like "$ref":
"#/definitions/rule" for each rule value ￼. According to the SchemaStore entry
for ESLint, a rule config is valid if it’s an integer 0-2, or one of
"off"/"warn"/"error", or an array (the schema may not fully validate the array
contents for every rule) ￼. Similarly, the env and globals fields can be modeled
as objects with string keys and boolean/string values. The JSON Schema can
express most of these structural rules, though it may not enumerate every
possible plugin rule. In practice, ESLint’s own config validation is limited, so
the JSON Schema helps catch obvious mistakes (like a typo in severity, wrong
data types, etc.).

Representation in TypeScript Types

TypeScript can model the ESLint config shape using interfaces or type aliases.
We can define a TypeScript interface that closely mirrors the schema:

type RuleSeverity = 0 | 1 | 2 | "off" | "warn" | "error"; type RuleConfig =
RuleSeverity | [RuleSeverity, ...any[]];

interface ESLintConfig { root?: boolean; extends?: string | string[]; env?: {
[envName: string]: boolean | undefined }; // undefined if not set globals?: {
[name: string]: "readonly" | "writable" | boolean | undefined }; parser?:
string; parserOptions?: { ecmaVersion?: number | "latest"; sourceType?: "script"
| "module"; ecmaFeatures?: { [feature: string]: boolean | undefined }; [key:
string]: any; // to allow parser-specific options like `project` }; plugins?:
string[]; rules?: { [ruleName: string]: RuleConfig }; settings?: { [name:
string]: any }; ignorePatterns?: string | string[]; overrides?: Array<{ files:
string | string[]; excludedFiles?: string | string[]; processor?: string; // The
same properties as ESLintConfig (except you typically wouldn’t nest overrides
further) extends?: string | string[]; env?: { [envName: string]: boolean |
undefined }; globals?: { [name: string]: "readonly" | "writable" | boolean |
undefined }; parser?: string; parserOptions?: ESLintConfig["parserOptions"];
plugins?: string[]; rules?: { [ruleName: string]: RuleConfig }; settings?: {
[name: string]: any }; }>; }

In this TypeScript definition, all fields are optional (using ?) because a
config file might omit them. We use index signatures (like [ruleName: string]:
RuleConfig) to allow any rule name, since ESLint supports arbitrary rule keys
(including those from plugins). Similarly, env and globals use index signatures
because the set of environment names or global variables is open-ended. This
means TypeScript won’t error on unrecognized keys for those objects – aligning
with how ESLint allows any properly named env or global.

Optional Fields: Most fields in ESLint config are optional, which is naturally
represented in TypeScript by making properties optional or using undefined for
values. For example, extends?: string | string[] means the config may or may not
include an extends property. TypeScript handles optional properties well.

Nested Configs (Overrides): The overrides array is represented as an array of
objects, each object having its own fields similar to the main config. In the
type, we ensure each override object has a files property (string or string[])
and optionally its own excludedFiles and other settings. This models the nested
configuration pattern. We reuse types where appropriate (e.g. parserOptions?:
ESLintConfig["parserOptions"] to keep it consistent). TypeScript can express
this nesting, although we must duplicate some structure in the type definition
(there’s no direct way to say “the override object has the same shape as
ESLintConfig” except by referencing or extending the interface and making
adjustments).

Plugin Overrides: There isn’t a distinct concept of “plugin overrides” separate
from the above; presumably this refers to how plugin configurations or rules can
be overridden in the config. In our type, plugin-provided rule names are just
strings (like "@typescript-eslint/ban-types"), which are allowed by the index
signature in rules. Extending a plugin’s recommended config is done via extends
(string entries starting with "plugin:"), which our type allows as strings in
the extends array. So the TypeScript type covers those scenarios by design. If
needed, one could be more strict by enumerating known core rule names or env
names, but that becomes quickly outdated – it’s more practical to use string
indices.

Strengths: TypeScript’s type system can capture the shape (keys and value types)
of the ESLint config quite well: required vs optional, allowed value types
(using union types for things like severity or extends), and nested objects. We
can even represent a union of number-or-string for severity, as shown in
RuleSeverity. This means if someone tries to put an invalid value, e.g.
"critical" as a severity, TypeScript will raise a compile-time error. Likewise,
wrong data types (like using a number where a string is expected) would be
caught in a properly typed config object.

Limitations: There are some constraints that TypeScript’s type system cannot
enforce at compile time: •	Rule Options Structure: Our RuleConfig allows
[RuleSeverity, ...any[]] for rule options because the specific options schema
varies per rule. We can’t precisely type the options for each rule name without
an enormous union or mapping of each rule to its options type. In JSON Schema
(or runtime), you might leave it broadly typed as well (or not validate deeply)
for similar reasons. So TypeScript here sacrifices some precision for
flexibility. •	Conditional Requirements: If a field combination had
interdependencies (for example, ESLint might require that an override object has
a files property – which it does – but we made it non-optional in the type to
enforce that). TypeScript can enforce that files is present by not marking it
optional. But more complex conditions (like “if parser is X, then parserOptions
must include Y”) cannot be encoded in the static type easily. •	Additional
Properties: By default, TypeScript will allow extra unknown properties on an
object assigned to an interface if it’s a literal (it performs excess property
checking on object literals). In our ESLintConfig interface, we did not include
an index signature at the top level, so an unknown top-level key like "typo":
123 would error in a literal. This matches JSON Schema’s likely intent of
disallowing unknown keys (to catch typos). However, at runtime ESLint might
simply ignore unknown keys without failing. TypeScript doesn’t have a built-in
notion of “no additional properties” beyond the static check on object literals,
and even that can be bypassed (e.g. by assigning via intermediate variables or
using type assertions). So there is a slight mismatch: JSON Schema or a runtime
validator can be strict about no unexpected fields, whereas TypeScript’s type
system is not a full guarantee in all scenarios (it’s a design-time aid only).

Representation in Zod Schemas

Zod is a TypeScript-friendly schema validation library that can define runtime
schemas which also infer static types. We can model the ESLint config in Zod
with a schema that closely corresponds to the JSON Schema and TypeScript
interface above.

Using Zod, the schema might be constructed as follows (illustrative snippet):

import { z } from "zod";

const RuleSeverity = z.union([ z.enum(["off","warn","error"]), // string
severity z.number().int().min(0).max(2) // numeric severity 0-2 ]); const
RuleConfig = z.union([ RuleSeverity, z.tuple([RuleSeverity]) // tuple with just
severity, // we'll handle options as variable length ]).or( // or: alternate
approach with refinement below z.array(z.unknown()).superRefine((arr, ctx) => {
// Custom refinement: first element must be a valid RuleSeverity if(arr.length
=== 0) { ctx.addIssue({ code: "custom", message: "Rule config array must not be
empty" }); } else if (!RuleSeverity.safeParse(arr[0]).success) { ctx.addIssue({
code: "custom", message: "First element of rule config array must be 0/1/2 or
off/warn/error" }); } }) );

const ConfigSchema: z.ZodType<ESLintConfig> = z.object({ root:
z.boolean().optional(), extends: z.union([z.string(),
z.array(z.string())]).optional(), env: z.record(z.boolean()).optional(),
globals: z.record(z.union([ z.literal("readonly"), z.literal("writable"),
z.boolean() ])).optional(), parser: z.string().optional(), parserOptions:
z.object({ ecmaVersion: z.union([z.number().min(0),
z.literal("latest")]).optional(), sourceType:
z.enum(["script","module"]).optional(), ecmaFeatures:
z.record(z.boolean()).optional() // plus allow any additional fields for
parser-specific options }).catchall(z.unknown()).optional(), plugins:
z.array(z.string()).optional(), rules: z.record(RuleConfig).optional(),
settings: z.record(z.unknown()).optional(), ignorePatterns: z.union([z.string(),
z.array(z.string())]).optional(), overrides: z.array(z.object({ files:
z.union([z.string(), z.array(z.string())]), excludedFiles: z.union([z.string(),
z.array(z.string())]).optional(), processor: z.string().optional(), extends:
z.union([z.string(), z.array(z.string())]).optional(), env:
z.record(z.boolean()).optional(), globals: z.record(z.union([
z.literal("readonly"), z.literal("writable"), z.boolean() ])).optional(),
parser: z.string().optional(), parserOptions: /* reuse parserOptions schema _/
z.object({/_...*/}).catchall(z.unknown()).optional(), plugins:
z.array(z.string()).optional(), rules: z.record(RuleConfig).optional(),
settings: z.record(z.unknown()).optional() })).optional() }).strict();

This Zod schema attempts to capture the same structure: •	Basic Types: We use
Zod primitives and unions to define the allowed types. For example, extends is
z.union([z.string(), z.array(z.string())]) to allow either a single string or an
array of strings. Fields like root, parser, etc., are straightforward with
.optional() if not required. •	Union types: Zod handles union types for values
like rule severity. We defined RuleSeverity as a union of a string enum and a
number range, similar to the JSON Schema ￼ ￼. For rule configurations
(RuleConfig), we used a union that allows either a plain severity or a
tuple/array. Because Zod doesn’t have a direct way to express “array of any
length with first element of a certain type,” we used a .superRefine on a
generic z.array(z.unknown()) to enforce the first element’s type manually. This
shows one of Zod’s strengths: we can add custom refinement logic beyond basic
type checking, which JSON Schema cannot easily do for such sequence-dependent
validation. •	Optional fields: .optional() is used extensively to mirror the
fact that fields are not required. We can also use .default(...) if we want to
supply default values. For example, we might do root: z.boolean().default(false)
if we want the absence of root to be treated as false. In JSON Schema, a default
can be specified (e.g., default false for root), but it’s only metadata – the
validator won’t automatically insert it. Zod, however, will fill in a default
during parsing if configured. This difference means using Zod’s .default is a
one-way operation (it affects runtime result, whereas converting to JSON Schema,
that default might be lost or just informational). •	Nested (Overrides): Similar
to TypeScript, we define the overrides as an array of objects with their own
schema. We ensure files is required in each override (no .optional() on files),
so Zod will fail if an override lacks a files field – matching ESLint’s
requirement. We reuse or duplicate sub-schemas for fields inside overrides. Zod
allows referencing schemas (we could define a base config schema and reuse
parts), but careful not to allow infinite recursion. In practice, we wouldn’t
nest overrides inside overrides, so it’s fine. •	Catch-all vs Strict: By calling
.strict() on the main object, we tell Zod to disallow unknown top-level keys
(any keys not listed in the schema will cause an error). This aligns with JSON
Schema’s typical approach of "additionalProperties": false for an object, if we
choose to enforce that strictly. ESLint itself might ignore unknown keys
quietly, but for consistency we usually treat them as mistakes. Alternatively,
we could use .catchall(z.unknown()) or .passthrough() to allow extra properties.
In the snippet above, we used .catchall(z.unknown()) on parserOptions to allow
arbitrary extra keys in parserOptions (since parserOptions may include unknown
keys for custom parsers). For the main config object, however, we used .strict()
to catch typos at the top level.

Ability to Express Patterns: Zod can represent nearly everything the TypeScript
interface did: •	Optional fields, unions, and even value refinements (like
number range, string enums) are straightforward. •	The tricky part was
expressing the rule array shape. We demonstrated using .superRefine for that.
This goes beyond what JSON Schema can conveniently express (JSON Schema could
enforce the first array element with a schema using items and additionalItems,
but since the rest of the array is freeform, many schemas just treat the rule
value as any[] after the first item). •	Zod can enforce things like “array must
not be empty” or other complex validations with code (refine), which JSON Schema
cannot easily or at all (JSON Schema has no concept of custom code, only
declarative constraints).

Defaults & Transformations: Zod supports .default(), as noted, to supply default
values for missing fields (e.g., default severity maybe). It also supports
.transform() to transform inputs to a different output type. For example, one
could .transform a string to a Date, or trim strings, etc. However, using
transformations means the Zod schema’s inferred TypeScript type
(z.infer<typeof schema>) becomes the transformed type (post-transformation), and
the schema no longer purely describes the JSON structure. This is an important
distinction: JSON Schema and pure TypeScript types have no concept of runtime
transformation – they describe the shape of data, not how to convert it. So if
we used transform in Zod (say, to automatically turn "off" into the number 0
internally), we could validate and convert in one step, but that transformed
output can’t be captured by JSON Schema. In fact, the library zod-to-json-schema
explicitly notes that it reflects the input side of the Zod schema, not the
output of transforms ￼. For maximum compatibility, a schema meant to round-trip
between formats would avoid .transform and stick to using Zod for validation
(and perhaps use separate logic for applying defaults or transformations if
needed).

Refinements: Similar caution applies to .refine(). Zod can perform checks that
go beyond what static JSON Schema or TypeScript can do – for example, checking
that a number is prime or that a string satisfies a custom function. These
refinements will run at runtime, but if we convert to JSON Schema or TypeScript,
those formats won’t know about these extra rules (JSON Schema can’t include
arbitrary code checks; TypeScript types can’t enforce arbitrary predicates).
Zod’s documentation points out that it was designed to mirror TypeScript as much
as possible, but many “refinement types” (like “non-empty string” or “integer”)
can’t be represented in TypeScript’s type system ￼. We see this with our rule
array example: we refined it in Zod (runtime check), but in TypeScript we had no
way to encode “first element of array must be severity” except by possibly
making a tuple type for each rule name which is impractical.

In summary, Zod can fully capture the ESLint config structure and enforce
additional constraints at runtime, but if we aim for cross-format compatibility,
we’d use Zod’s features in a constrained way – mostly structural validation and
basic types, avoiding heavy use of .refine or .transform that can’t be
translated to JSON Schema or TypeScript easily.

Round-Trip Transformations Between Formats

Representing a schema in JSON Schema, Zod, and TypeScript opens up the
possibility of converting or generating one form from another. In an ideal
world, we could round-trip between these representations without losing
information. In practice, each representation has unique capabilities and
limitations, so perfect two-way conversion is challenging. Here’s an analysis of
each pair:

JSON Schema ↔ Zod •	JSON Schema to Zod: It is possible to programmatically
create a Zod schema from a JSON Schema. Tools like json-schema-to-zod exist to
automate this ￼ ￼. The conversion can map JSON Schema types (string, number,
object properties, etc.) to Zod equivalents. However, not all JSON Schema
features map cleanly. For example, JSON Schema’s "enum" can become z.enum,
"oneOf" can become z.union. Some things like pattern validation (regex) might
require a .refine in Zod (since Zod doesn’t have a direct regex for arbitrary
patterns except on strings). The json-schema-to-zod project notes that JSON
Schema and Zod don’t have a 100% overlap and that some details “may be lost in
translation”, recommending to use a JSON Schema validator (like Ajv) directly on
data if absolute fidelity is needed ￼. This means if the JSON Schema had
constraints that Zod can’t represent (or we choose not to represent in Zod), the
automatic conversion might drop them or replace them with a looser check. •	Zod
to JSON Schema: There is a popular library zod-to-json-schema that generates a
JSON Schema from a Zod schema. This works well for the purely structural
aspects. One important caveat is that it reflects the input side of the Zod
schema, not the output ￼. In other words, if your Zod schema has
transformations, the JSON Schema will describe the original data format (because
JSON Schema can’t describe the transformed output). For our ESLint config
example, if we avoid transforms, the JSON Schema generated should closely match
the intended schema. Custom refinements in Zod are another sticking point: they
might be completely omitted in the generated JSON Schema or represented only
partially (for instance, if we refined a string to have max length 255, we
should have just used .max(255) which can translate, but a completely custom
refine function has no JSON Schema equivalent). The good news is that our ESLint
schema doesn’t need such exotic refinements in principle; it’s mostly basic
types, unions, and known patterns that JSON Schema can handle. So round-tripping
from Zod to JSON Schema and back to Zod (via those libraries) could work for the
ESLint config if we design the Zod schema in the limited way. But if we had used
.transform or unusual .refine, the JSON Schema generated would be incomplete,
and converting that JSON Schema back to Zod might not yield the original logic.

Zod ↔ TypeScript •	Zod to TypeScript: Zod is designed with TypeScript in mind.
Any Zod schema has an inferred TypeScript type (using z.infer<typeof schema>).
In practice, many developers define the Zod schema and then use z.infer to get
the TypeScript type, ensuring they stay in sync ￼. For example, our ConfigSchema
above would infer a type essentially identical to the ESLintConfig interface we
wrote. That means one-way, Zod -> TS, is straightforward and lossless for the
shape of the data. However, TypeScript’s type will not capture Zod’s refinements
or default transformations. It will simply show types like string, number, etc.,
and maybe branded types if Zod had those (Zod doesn’t brand by default). For
instance, if Zod restricts a number to 0-2, the TypeScript type is just number
(there’s no native way to encode the 0-2 range in the type except by union of
literals 0|1|2 or a branded type). In our case, we explicitly used a union for
0|1|2, so the inferred type does capture that. But if we had used .min(0).max(2)
on a number, the TS type would be just number, losing the range info. So to be
fully consistent, we sometimes need to design the Zod schema in a way that uses
unions or literals for discrete values (like we did for severity) rather than a
broad type with refine. •	TypeScript to Zod: This is essentially the inverse
problem – given a TypeScript type (interface) produce a Zod schema. There’s no
native capability in TypeScript to do this automatically at runtime (since the
types are erased at runtime). However, there are community tools (like ts-to-zod
or ts-json-schema-generator combined with json-schema-to-zod) that can help
generate Zod schemas from TypeScript definitions ￼. These tools often rely on
parsing the TypeScript type or using the compiler API. A straightforward
scenario is turning each field of an interface into a Zod schema call. The
difficulty comes with unions and optionals – but those are handleable – and
especially with generic or conditional types (which likely aren’t in our ESLint
case) and literal narrowing. Also, pure TypeScript types might not include
runtime information like regex patterns or custom constraints, because
TypeScript types usually don’t either. If the TypeScript type included something
like a branded type to indicate a constraint, the generator might not know how
to translate that. For example, type Int = number & { __intBrand: any } is
sometimes used to indicate an integer – a TS-to-Zod tool might not catch that
meaning without additional hints. In our ESLint schema, TS to Zod conversion is
feasible since it’s mostly straightforward types, but one would have to manually
incorporate things like “the first element of array is severity” because that
was not fully captured in the TS type (we allowed ...any[] for options). This
shows an asymmetry: Zod (with refine) was more expressive than the TS type. So
converting TS -> Zod might produce a Zod schema that accepts more than the real
ESLint schema, unless we add custom refinements by hand.

JSON Schema ↔ TypeScript •	JSON Schema to TypeScript: There are established
tools to generate TypeScript types from JSON Schema (e.g.
json-schema-to-typescript by Bcherny, or quicktype). These tools interpret the
schema and produce equivalent interface or type definitions. For instance, an
object with properties and required fields becomes a TS interface with
optional/required properties. Union types (oneOf/anyOf) become TypeScript union
types (though sometimes tricky if schemas overlap). Enum in JSON Schema becomes
a TypeScript union of literals. For ESLint’s schema, running such a tool would
likely produce a type similar to our handwritten ESLintConfig. One challenge is
that JSON Schema can express things that TypeScript’s type system does not
directly have: e.g., a numeric range, regex pattern on string, or complex
conditional dependencies. If the JSON Schema is strict (e.g., the rule severity
using numeric range), the generator might either ignore those (leaving it just
number) or include them as comments in the output. Some advanced generators use
JSDoc annotations to preserve constraints (like @minimum 0 @maximum 2 on a
number). But those don’t enforce anything in the type; they’re just
documentation. In the ESLint schema, the numeric range for severity can instead
be represented as union of 0|1|2, which can be a TypeScript union. If the JSON
Schema was authored with literal enums for 0,1,2 and “off”,“warn”,“error”, then
the conversion will capture it exactly (as our type did). So it depends on how
the JSON Schema is written. SchemaStore’s definition did use min/max for the
numeric severity ￼, but we can treat that as literals to be safe. •	TypeScript
to JSON Schema: This is essentially a form of serialization of the static type
to a schema format. Libraries like typescript-json-schema or
ts-json-schema-generator can take TS interfaces and emit a JSON Schema. This
works well for basic shapes. Our ESLintConfig interface could be converted:
optional properties become not required in schema, union types become
oneOf/anyOf or enum lists, index signatures become additionalProperties or
patternProperties in JSON Schema. For example, a [ruleName: string]: RuleConfig
might be turned into a schema with patternProperties: { ".*": { $ref:
"#/definitions/RuleConfig" } } for the rules object. One tricky part is that
TypeScript’s index signature has no regex attached – it means any key – whereas
we might want to express a tighter pattern (like env names matching a known
set). The generator won’t impose a pattern unless we had some hint (and usually
it can’t; it would just allow any key). Another issue: as mentioned, TS types
don’t include things like numeric ranges or regex, so unless we used literal
unions, the JSON Schema generator might not know, for example, that a number is
limited to 0-2. If the TS type was just number for severity, the JSON Schema
output might allow any number. So to get a good JSON Schema, the TypeScript
definition needs to be written in a restrictive way (using literal union for
discrete values, etc.), which we did. Conditional logic in TS (like a
discriminated union) can become if/then in JSON Schema if supported, but complex
types might be dropped. In our ESLint case, the type is straightforward enough
that TS->JSON Schema should be feasible and largely align with the original JSON
Schema (again, assuming we captured things like severity properly as union of
literals).

Summary of Round-Trip: •	Converting from one format to another is possible, but
doing a full round-trip (A→B→A) without losing anything requires sticking to the
common subset of features. For ESLint’s config, if we treat it as a MetaType
(see next section) and avoid fancy stuff, we could go TS -> JSON Schema -> Zod
-> TS in theory and end up with an equivalent type definition. •	In practice,
one might choose a single “source of truth” (for example, maintain the Zod
schema in code and generate JSON Schema and TS types from it, or maintain a JSON
Schema and derive types from it). Each approach has trade-offs. JSON Schema is
great for validation in many languages and tools, TypeScript is best for
developer experience in code, and Zod gives runtime validation in JS/TS with
type inference. It’s been noted that Zod has more expressive power than JSON
Schema (e.g., transformations, custom refinements), so if we start with Zod, we
have to be careful not to use those extra powers if we need JSON Schema output
￼. Conversely, JSON Schema can express some things like pattern constraints that
TypeScript doesn’t natively, so starting from JSON Schema one must accept that
the TypeScript type might be a looser approximation ￼.

Constraints for a “MetaType” Schema (Full Reversible Compatibility)

To qualify as a MetaType (a schema that can be fully and reversibly represented
in JSON Schema, Zod, and TypeScript), the schema must be designed within the
intersection of expressivity of all three systems. Key constraints and
guidelines include: 1.	No Runtime-Only Logic: Avoid any validation or
transformation that exists in Zod or code but has no representation in static
schema. This means no use of Zod’s .transform() (or if used, accept that it’s
not representable in JSON Schema/TS) and limit .refine() to checks that could
also be expressed in JSON Schema (e.g., string length, regex pattern, numeric
range). Arbitrary .refine() with custom logic would break round-trip
compatibility since neither JSON Schema nor pure TS can capture that logic ￼.
2.	Use Structural Constraints Only: Stick to the core data types and structural
composition that all three support. Basic types (string, number, boolean,
object, array, null), optionality, and fixed combinations via union or enum are
safe. For example, use TypeScript literal union types (like "off"|"warn"|... or
0|1|2) for enumerated values so that JSON Schema can use enumorconstfor those
and Zod can usez.enum` or literals. If a numeric range is desired, consider
using a union of explicit literals if the range is small; otherwise, understand
TS will lose the range (so this might violate full reversibility unless you
accept a partial loss). 3.	Avoid Complex Conditional Schemas: JSON Schema can do
conditional schemas (if A then B must/must not), and TypeScript can sometimes
model these with union types or mapped types, but it gets very complicated. A
MetaType should likely avoid conditional dependencies that aren’t easily modeled
in TS. If needed, prefer discriminated unions – e.g., an object that has a field
type: "X" and then schema differs based on that – because TS can represent that
(as a union of interfaces with type literal fields) and JSON Schema can too
(oneOf with required discriminator). But something like “property A requires
property B to be present” without a clear discriminator is harder in TS (you’d
need to make A and B a union of two object shapes, one with both, one with
neither). 4.	No Inherently Unbounded Polymorphism: For instance, JSON Schema’s
additionalProperties or patternProperties can allow any new property with a
given type. TypeScript can model additionalProperties by an index signature
[key: string]: ..., but if you want to restrict the pattern of keys (e.g., must
match a regex), TypeScript can’t enforce that. To remain reversible, you’d avoid
pattern-based constraints on property names that TS can’t mirror. In a MetaType,
you might allow additional properties freely (so TS index signature with no
regex, JSON Schema patternProperties with .*). Or, enumerate known keys and
disallow others (both TS and JSON Schema can do that). In the ESLint config, for
example, the rules object effectively allows additional arbitrary keys (rule
names). We handled that with a TS index signature and JSON Schema would allow
any key. That’s acceptable. But if we had a requirement like “all rule keys must
contain a slash if they belong to a plugin”, that’s not something TS can check,
so it shouldn’t be a MetaType rule. 5.	Consistent Optional/Default Handling: If
you use defaults, understand that JSON Schema’s default is not automatically
applied, and TypeScript optional doesn’t equate to a default value. To be fully
reversible, treat defaults as documentation rather than enforced behavior.
Alternatively, apply defaults in Zod but don’t consider it part of the type’s
validity, only as a post-processing. A MetaType should not rely on the presence
of a default to be considered “complete” – it should be valid even without the
field, and all three representations agree on that. For example, in ESLint
config, root default could be false, but we consider both “absent” and “false”
as equivalent valid states. 6.	Discrete Union Clarity: If using unions
(oneOf/anyOf), ensure that the variants are either distinguishable by type shape
or treated permissively the same by all. JSON Schema’s oneOf can have ambiguity
if two schemas overlap. TypeScript’s union does not inherently enforce
exclusivity at runtime, but at compile time it will consider all possibilities.
To keep them aligned, ideally each union branch should be a clearly different
type or have a tag. In our ESLint case, RuleConfig union branches overlap (both
number and string are primitives, and array is separate). We managed that by
allowing all in TS and Zod. JSON Schema oneOf would technically match a number
or string easily; for an array it would match the array schema. That should be
fine (they’re distinct types). Problems arise if you had something like union of
two object schemas where one is not easily distinguished from the other; then
JSON Schema might need extra constraints (like
"type":"object","required":["type"] in each) to discriminate. So define unions
that can be consistently validated in all systems. 7.	No Function Types or
Non-data Types: This is obvious, but JSON Schema is only for JSON data (no
functions, no class instances). TypeScript can have function types, classes,
etc., and Zod can even refine things about functions, but those are out-of-scope
for JSON. A MetaType should describe data-only structures that can be
represented in JSON.

By adhering to these constraints, a schema can be a true MetaType – meaning you
could, for example, define it in Zod, derive JSON Schema and a TypeScript type,
and if someone else regenerated the Zod schema from that JSON Schema or TS,
they’d get the equivalent validation logic. In other words, no information about
the data shape or basic validation is lost or inconsistent across formats.

In the context of ESLint’s config, we see that by sticking to basic types,
unions, and optional properties (and avoiding things like custom validation
code), it largely meets these MetaType criteria. The schema for ESLint config
doesn’t require fancy transforms or conditional logic beyond what’s
representable (except perhaps the nuance of rule option arrays, which we handled
with a refinement in Zod – that part is borderline, since JSON Schema can’t
enforce it and TS doesn’t either; one might consider that outside the MetaType
and live with it or enforce via tests).

Test Cases for Cross-Format Equivalence

To ensure our TypeScript types, Zod schema, and JSON Schema all describe the
same set of valid configs, we should devise a suite of test cases. Each test
case is essentially an example ESLint config (as a JSON object) that we expect
to be either valid or invalid. We then verify that: •	TypeScript: the config
object satisfies the ESLintConfig type (or causes a type error if it’s invalid),
•	Zod: ConfigSchema.parse(obj) succeeds (or throws with errors if invalid),
•	JSON Schema: using a validator like Ajv on the JSON Schema yields valid (or
errors).

The tests should cover normal usage and edge cases, especially where the schema
might be complex. Here are some recommended test cases: 1.	Minimal Valid Config:
An empty config object {}. •	Expected: TypeScript allows it (all fields
optional), Zod parsing succeeds (all optional, no required fields violated),
JSON Schema validation succeeds (no required fields). This ensures that our
schemas don’t erroneously require something that ESLint doesn’t (ESLint is fine
with an empty config, effectively all defaults). 2.	Full Valid Config: A config
that exercises most fields:

{ "root": true, "extends": ["eslint:recommended", "./my-base.js"], "env": {
"browser": true, "node": false }, "globals": { "MY_GLOBAL": "writable",
"Promise": "readonly" }, "parser": "@typescript-eslint/parser", "parserOptions":
{ "ecmaVersion": 2020, "sourceType": "module", "project": "./tsconfig.json" },
"plugins": ["@typescript-eslint"], "rules": { "eqeqeq": "warn", "quotes":
["error", "double"], "@typescript-eslint/ban-types": ["error", {
"extendDefaults": true }] }, "settings": { "react": { "version": "detect" } },
"ignorePatterns": ["**/dist/*", "temp.js"], "overrides": [ { "files":
["**/_.ts", "**/_.tsx"], "excludedFiles": "*.test.ts", "parser":
"@typescript-eslint/parser", "parserOptions": { "project": "./tsconfig.json" },
"plugins": ["@typescript-eslint"], "extends":
["plugin:@typescript-eslint/recommended"], "rules": { "no-unused-vars": "off" }
} ] }

    •	Expected: This should pass all validations (TS, Zod, JSON Schema). It touches nested overrides, arrays and single values, plugin rules, etc. It will test that, for example, our union types accept both string and array forms, and that overrides accept an array of objects.

    3.	Invalid Type in Field: e.g. "extends": 5 (number instead of string/array), or "env": ["browser"] (array instead of object), or "rules": "strict" (should be object, not string).
    •	Expected: All three mechanisms flag the error. TS should show a type error at compile time, Zod should throw a validation error, and JSON Schema validator should report a type mismatch. This ensures that basic type enforcement is consistent.
    4.	Invalid Rule Severity: e.g. "rules": { "eqeqeq": "critical" } or { "eqeqeq": 3 }.
    •	Expected: All validators reject it. TS will complain that "critical" is not assignable to the union type and 3 is not in 0|1|2. Zod should fail the union match (we included enum 0-2 and strings off/warn/error). JSON Schema should fail (if it uses enum or maximum=2 as in SchemaStore) ￼ ￼. This test checks that the union of literal values is in sync.
    5.	Missing Required Override Field: For example:

{ "overrides": [ { "rules": { "semi": "error" } } // missing "files" ] }

    •	Expected: This is invalid because each override must specify files. TS will catch it because in our type files is not optional in the override type. Zod will catch it because the schema requires files. JSON Schema (if we wrote it to require files in override objects) will also catch it. We want to ensure our schemas are enforcing that critical requirement uniformly.

    6.	Extra Unknown Property: e.g. { "root": true, "foo": 42, "rules": {} }.
    •	Expected: Likely invalid. Our TypeScript type does not include "foo", so TS would error on a literal object having an unknown key. Zod with .strict() will throw an unknown key error. JSON Schema, if additionalProperties: false at top level, will flag it. This test confirms that our choice to disallow unrecognized keys works. (If we had chosen to allow extra properties, then the expected outcome would be that all three allow it. In a MetaType context, we decide one way and ensure consistency.)
    7.	Check Transform/Refine Absence: While not a specific input case, we should conceptually test that we didn’t include anything like a transform that would alter data. For instance, if our Zod schema had a .default, we might test that providing no root yields an object where Zod supplies root=false. But since JSON Schema can’t apply that, we might avoid that in the first place. Essentially, this is to verify that the three formats agree on what is considered valid and they don’t implicitly change the data differently. In our MetaType approach, we treat all as just validators (no one is adding or removing data except perhaps stripping unknown keys, which we intentionally align TS (error) and Zod (.strict) and JSON Schema (no additional) to all do).

For each of these cases, the expected result (valid or invalid) should be the
same across TypeScript, Zod, and JSON Schema validations. If any case passes in
one format but fails in another, that indicates a discrepancy in our schema
representations: •	For example, if TS allowed something that Zod/JSON
disallowed, maybe our TS type was too broad (or we used any somewhere). •	If Zod
allowed something TS disallowed, perhaps we forgot a refinement or used
.unknown() too liberally. •	If JSON Schema was off, perhaps we didn’t capture a
union correctly.

By designing the schema carefully and running these tests, we can have high
confidence in round-trip consistency. In fact, implementing such test cases is a
good practice when maintaining parallel schema definitions: you catch mismatches
early by validating a corpus of sample configs against all representations.

Notes on Tool Limitations and Loss of Information

It’s important to acknowledge the limitations and differences of each approach:
•	TypeScript: provides compile-time checks only. It does not enforce anything at
runtime. So an ESLint config loaded from a JSON file won’t be automatically
validated by the TypeScript type unless you manually run it through a checker.
Also, TypeScript’s type system can’t capture certain nuances (like regex
patterns or numeric ranges) except by making them explicit union types or with
documentation ￼. This means some constraints either can’t be represented or can
be bypassed (e.g., extra properties as discussed). However, TypeScript is
excellent for ensuring consistency during development and preventing obvious
mistakes. •	JSON Schema: is a runtime validation schema (typically used with a
validator like Ajv). It’s very good for describing data shape in a
language-agnostic way and can catch issues like type mismatches or missing
required fields. But JSON Schema itself is just data (usually JSON format); it
doesn’t execute on its own – you need a validator to get runtime checks. Also,
JSON Schema can’t perform arbitrary computations or side effects; it’s purely
declarative. Some complex things are beyond its scope (no custom functions, no
cross-field arithmetic comparisons, etc.). In our context, JSON Schema couldn’t
enforce “first element of array is X” elegantly without potentially
over-specifying each rule name’s schema. We rely on a simpler validation. JSON
Schema also doesn’t automatically apply defaults or do type coercion (whereas
Zod could, if instructed). •	Zod: offers runtime validation in code with a
convenient syntax and ties into TypeScript. It can enforce everything JSON
Schema can (to the extent JavaScript can, including regex via .regex() on
strings, numeric bounds, etc.) and more, because you can always plug in a custom
refinement function for any rule. It also can transform data as it validates,
which is powerful for certain use cases (parsing and converting in one step).
The trade-off is that those extra powers don’t translate to static schema – they
live in code. As noted, Zod can express transformations that JSON Schema can’t
￼, and it can enforce refinements that TypeScript won’t know about ￼. If we use
those, we break the round-trip fidelity. Another limitation is that Zod is a
library for JavaScript/TypeScript; it’s not directly usable in other languages
or tooling, whereas JSON Schema is language-agnostic. For large schemas, Zod can
also become unwieldy or slow at runtime compared to highly optimized JSON Schema
validators, but for config sizes this is usually fine.

In conclusion, representing the ESLint config schema in all three formats is
quite feasible. ESLint’s config (eslintrc) mainly uses patterns (optional
fields, unions for values, nested override objects) that are well within the
capability of JSON Schema, TypeScript, and Zod. By carefully aligning the
expressiveness and writing test cases, we can achieve a consistent “MetaType”
representation. We just have to be mindful of each tool’s limitations – avoiding
using features of one that the others can’t match – so that our ESLint config
schema remains truly portable and verifiable across all formats.

Sources: •	ESLint configuration file examples and field descriptions ￼ ￼ ￼ ￼ ￼ ￼
￼ •	SchemaStore’s ESLint JSON Schema (rule severity definition) ￼ ￼ •	Zod
documentation on refinements and design goals ￼ •	Remarks on Zod vs JSON Schema
capabilities ￼ ￼ •	Differences between type systems and validation (TypeScript
vs JSON Schema) ￼ and conversion tool notes ￼.
