# Census Custom API Connections

Census provides fast and reliable data synchronization from your data warehouse
to dozens of SaaS applications, via our SaaS connector library. Although we are
adding connectors as quickly as we can, we realize that there may be some
destinations that we will never support - bespoke or internal systems, niche
SaaS applications, or applications with private APIs.

Custom APIs allow you to "bring your own" SaaS connector to Census for use in
these types of integrations. In order to write a connector, you'll need to
implement a few simple APIs that teach Census about the type of data your
connector can process, the operations allowed on that data, and how to actually
load that data. You'll deploy this code to a URL on the internet that Census can
reach, then configure Census to discover your connector using that URL.

Custom APIs cannot be shared across Census accounts, and there is currently no
plan for community-owned connectors or a connector marketplace. There are a
number of core Census features that are not currently available to Custom APIs,
and the Census product team is committed to building high-quality first-party
connectors for as many SaaS applications as we can. Please contact us if Census
is missing a SaaS connector that you believe would be useful to our customer
community!

This guide documents the protocol that your Custom API will use to communicate
with Census, and provides tips on connector design, debugging, and
troubleshooting.

Custom APIs are a beta feature in Census. Please contact your account
representative if you'd like access to this feature and we'll get you set up!

## Getting Started

### What You'll Need

* A Census account that's enrolled in the Custom API beta (contact your sales
  rep to get access)
* A place to run your Custom API code. Custom APIs have to be accessible via a
  public endpoint over HTTPS, so if you're testing your code on a development
  machine, we recommend you use [ngrok](https://ngrok.com) or a similar tool to
  expose your local endpoint to a temporary public URL
* A destination to which you want to integrate. Generally speaking your Custom
  API will act as a proxy that passes data from Census to some destination SaaS
  system, though the destination can be any data store.
* A plan for testing you connection. You can use a Census model to "hard code" a
  small data set in your warehouse as a source for testing. You should initially
  point your API to a non-production destination while you test syncs to ensure
  you don't alter or overwrite any critical data. Once you have verified the
  correctness of your Custom API, you can start using it to sync production data
* The sample code contained in this repository can be a useful starting point
  for a Javascript or TypeScript integration - it takes care of the JSON-RPC
  protocol and provides stub implementations of some methods for simple Custom
  APIs.

### How It Works

Your Custom API is a bridge between Census and your destination SaaS or other
system. Census syncs are dividied into two phases, each of which will call
different methods on your API: planning and execution.

![Planning Diagram](assets/plan.png)

In the planning phase, Census will ask your API what kinds of data it manages
and what operations are available on that data. This phase is broken into three
API methods:
* `list_objects` - Get a list of the objects your API can write to.
* `list_fields` - Get a list of the fields, along with data types and validation
  rules, for a given object.
* `supported_operations` - Find out what kinds of "writes" can be performed on
  an object - can new instances be created? Can existing instances be modified?

![Execution Diagram](assets/execute.png)

Once the sync has been planned by the user (utilizing metadata from your API and
your data warehouse) it can be executed. At execution time, Census will call two
methods on your API:
* `get_sync_speed` - For a given sync plan, how quickly should Census send data
  to your API?
* `sync_batch` - Sync one batch of records to your destination, reporting
  success and failure for each record.

### Objects and Fields

Every Census connector has a schema, which is made up of *Objects* and *Fields*.
Objects are roughly analogous to tables in a database, whereas fields are like
columns. Your Custom API connector will tell Census what its schema is as part
of the planning process (via the `list_objects` and `list_fields` methods).
Census will use this information to populate its mapping API, and guide the
users of your Custom API to map tables and columns in their data warehouse to
your destination.

Every SaaS application has a different data surface it exposes to the world, and
there is some art in deciding how to model SaaS data APIs as objects and fields.
This also depends on the operations the SaaS application gives you (see below). 

Many SaaS applications / destinations do not provide APIs to discover objects
and fields. In this case, your Custom API should return a hard-coded list of
objects and fields and return those to Census.

### Operations

Destination systems may also have rules about what can be done with new and
existing data. Census currently allows Custom APIs to choose from three
operations for each object:
* `upsert` (most common) - records in the destination can be created or modified
* `insert` - records can only be created in the destination, they cannot be modified
* `update` - records can only be modified in the destination, they cannot be created

Census does not know whether a record already exists in your destination when
using a Custom API, so it is up to you to enforce the semantics of the
operation(s) you have chosen to support. For example, if Census has been
configured to `update` records in the destination but not `insert` them, your
Custom API must first check the destination to see if a matching record exists,
and tell Census to skip it if it does not exist. Some destination systems may
provide APIs like this for you (create this record only if it does not exist) if
they have strong enforcement of uniqueness on identifiers.

### Matching Source and Destination Data

Every sync plan created by Census for an `insert`, `update`, or `upsert` sync
will include a field that should be used as the identifier for matching source
and destination records. This field must be a unique and required in both
systems (the source data warehouse and the destination SaaS), and it will be
provided for every record. Your Custom API will tell Census (via the
`list_fields` method) which fields can be legally used as identifiers.

### Security Considerations

The requests that Census makes to your Custom API may include sensitive data
about your business or customers, and your API must protect that data. In
addition, your API must protect any secrets or credentials that it will use to
authenticate to the ultimate destination system.

All connections from Census to a Custom API must use HTTPS with a certificate
signed by a well-known CA - self-signed certificates are prohibited.

Your Custom API URL can include a cryptographically unguessable segment that you
can use to verify calls are coming from Census and not an imposter. For example,
if your Custom API is hosted at https://census-custom-api.yourcompany.example,
you could configure Census to invoke it as
https://census-custom-api.yourcompany.example?census_authentication=XoBcsUoFT82wgAcA and
verify all calls include the correct `census_authentication` value.

Secrets needed by your Custom API can be stored in several places:
* In environmental variables accessible to your Custom API - this is a common
  pattern supported by many API hosting platforms.
* In your application's source code - this is usually a bad practice because
  source code may not be stored as securely as environmental variables, but this
  depends on your organization's practices
* As query string or path segment parameters in your Custom API's URL. To
  continue the example above, if your Custom API needs an API key to access the
  destination system, you could include it as a second parameter:
  https://census-custom-api.yourcompany.example?census_authentication=XoBcsUoFT82wgAcA&api_key=Ur2NtbfiPuFSkdQp

Because your Custom API URL can contain secrets, it is considered to be
sensitive data by Census and encrypted within our logs and databases.

## Writing Your Custom API

### Sending and Receiving JSON-RPC messages

All communications between Census and your Custom API are JSON-RPC method
invocations. JSON-RPC is a simple protocol for request-reply conversations
between a client (Census) and a server (your Custom API). While there are
several libraries that can help you implement JSON-RPC, you may find it simpler
to "roll your own".

Census follows the [JSON-RPC 2.0
specification](https://www.jsonrpc.org/specification) with a few additional
restrictions to simplify things even more:
* `params` (in the request) and `result` (in the response) will always be JSON
  objects, not arrays.
* `params` will never be omitted - if a method has no params, an empty object
  (`{}`) will be sent as the value for `params`.
* JSON-RPC notifications (requests without an `id` that do not require a
  response) are not used in this protocol.
* JSON-RPC batching is not used - all HTTP sessions will contain exactly one
  request. Census will attempt to use HTTP Keep-Alive to reuse the connection
  for subsequent requests, but support for Keep-Alive is optional.
  
The JSON-RPC specification does not specify a transport layer. Census uses HTTPS
as the transport layer, with all messages sent as the body of an HTTP POST to a
single URL that your custom connector defines. The `Content-Type` of both the
HTTP request and response must be `application/json`.

Here's an example of a valid invocation of the `test_connection` method,
assuming your Custom API is located at https://example.com/census

#### HTTP Request

```http
POST /census HTTP/1.1
User-Agent: Census https://www.getcensus.com
Content-Type: application/json
Accept-Encoding: gzip;q=1.0,deflate;q=0.6,identity;q=0.3
Accept: */*
Connection: keep-alive
Keep-Alive: 30
Host: example.com
Content-Length: 96

{"jsonrpc":"2.0","method":"test_connection","params":{},"id":"d33ded2672b7877ff833c317892d748c"}
```

#### HTTP Response

```http
HTTP/1.1 200 OK
X-Powered-By: Express
content-length: 83
content-type: application/json; charset=utf-8
Date: Fri, 19 Mar 2021 00:25:21 GMT
Connection: keep-alive

{"jsonrpc":"2.0","id":"d33ded2672b7877ff833c317892d748c","result":{"success":true}}
```

Every request currently requires a synchronous response. Census will time out
requests that take a long time to complete; if your connector is unable to
complete its work (particularly the `sync_data` method) within this time, you
can use the `get_sync_speed` method to tell Census to send data more slowly
until you are able to complete within this timeout.

### Versioning

During the beta phase this API is unversioned. Backwards-incompatible changes
may occur; Census will attempt to notify impacted customers before making those
changes.

### Caching, State, and Parallel Invocations

Don't cache, try not to have any state (other than API keys), be prepared for
Census to call multiple methods in parallel (you have some control over this).

### Error Handling

Census will retry
Structured vs unstructure errors

* TCP / HTTP / TLS errors (low-level / connection-level)
* JSON-RPC errors (medium-level / protocol-level)
* Method-specific errors (high-level / application-level)
** test_connection
** sync_data

### RPC Details

TODO: insert api-methods.md here

## Using Your Custom API

### Deployment

### Configuration

### Debugging and Troubleshooting
