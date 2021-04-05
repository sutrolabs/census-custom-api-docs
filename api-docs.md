# Census Custom Connector API

Census provides fast and reliable data synchronization from your data warehouse
to dozens of SaaS applications, via our SaaS connector library. Although we are
adding connectors as quickly as we can, we realize that there may be some
destinations that we will never support - bespoke or internal systems, niche
SaaS applications, or applications with private APIs.

Custom connectors allow you to "bring your own" SaaS connector to Census for use
in these types of integrations. In order to write a connector, you'll need to
implement a few simple APIs that teach Census about the type of data your
connector can process, the operations allowed on that data, and how to actually
load that data. You'll deploy this code to a URL on the internet that Census can
reach, then configure Census to discover your connector using that URL.

Custom connectors cannot be shared across Census accounts, and there is
currently no plan for community-owned connectors or a connector marketplace.
There are a number of core Census features that are not currently available to
custom connectors, and the Census product team is committed to building
high-quality first-party connectors for as many SaaS applications as we can.
Please contact us if Census is missing a SaaS connector that you believe would
be useful to our customer community!

This guide documents the protocol that your custom connector will use to
communicate with Census, and provides tips on connector design, debugging, and
troubleshooting.

Custom connectors are a beta feature in Census. Please contact your account
representative if you'd like access to this feature and we'll get you set up!

## Getting Started

### What You'll Need

Census account with access to custom connector beta

Place to run your code
* can use ngrok in development

A destination system you're integrating with

Development plan / some way to do non-production testing

These docs

Sample code

### How It Works

You are implementing a server, Census is the client. Whenever you see a
"request" in this document, that's a message Census is sending to your custom
connection - the responses are what you send back.

Census calls several methods on your connector...
* discovery methods
* metadata methods
* data transfer method

### Objects and Fields

Every Census connector has a schema, which is made up of *Objects* and *Fields*.
Objects are roughly analogous to tables in a database, whereas fields are like
columns. Your custom connector will tell Census what its schema is as part of
the discovery process (via the `list_objects` and `list_fields` methods). Census
will use this information to populate its mapping API, and guide the users of
your connector to map tables and columns in their data warehouse to your
destination. 

Every SaaS application has a different data surface it exposes to the world, and
there is some art in deciding how to model SaaS data APIs as objects and fields.
This also depends on the operations the SaaS application gives you (see below). 

### Operations

### Security Considerations

Must use https

Mutual authentication between Census and your connector

Secret storage
* In URL
* Within your connector (hard-coded or environment)

## Writing Your Custom Connector

### Sending and Receiving JSON-RPC messages

All communications between Census and your custom connector are JSON-RPC method
invocations. JSON-RPC is a simple protocol for request-reply conversations
between a client (Census) and a server (your custom connector). While there are
several libraries that can help you implement JSON-RPC, you may find it simpler
to "roll your own".

Census follows the JSON-RPC 2.0 specification (link) with a few additional
restrictions to make things even simpler:
* `params` (in the request) and `result` (in the response) will always be JSON
  objects, not arrays.
* `params` will never be omitted - if a method has no params, an empty object
  (`{}`) will be sent as the value for `params`.
* JSON-RPC notifications (requests without an `id` that do not require a
  response) are not used in this protocol.
* JSON-RPC batching is not used - all HTTP sessions will contain exactly one
  request. Census will attempt to use HTTP Keep-Alive to reuse the connection
  for subsequent requests, but support for Keep-Alive is optional.
  
The JSON-RPC standard does not specify a transport layer. Census uses HTTPS as
the transport layer, with all messages sent as the body of an HTTP POST to a
single URL that your custom connector defines. The `Content-Type` of both the
HTTP request and response must be `application/json`.

Here's an example of a valid invocation of the `test_connection` method,
assuming your connector is located at https://example.com/census_connector

#### HTTP Request

```http
POST /census_connector HTTP/1.1
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

Every request currently requires a synchronous response. Census will wait up to
TODO NNN minutes for your custom connector to respond before timing out the HTTP
connection. If your connector is unable to complete its work (particularly the
`sync_data` method) within this time, you can use the batch controls (TODO
where?) to tell Census to send smaller batches until you are able to complete
within this timeout.

### Versioning

During the beta phase this API is unversioned. Backwards-incompatible changes
may occur; Census will attempt to notify impacted customers before making those
changes. Future editions of the API will have versions and will allow the
connector to declare which version it supports.

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

## Using Your Custom Connector

### Deployment

### Configuration

### Debugging and Troubleshooting
