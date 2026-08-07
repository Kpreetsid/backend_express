# Performance and Capacity

Use observed production traffic when available. Until then, certify against 250 requests/second and 2,000 concurrent notification sockets; load tests run at twice observed API peak and 1.5 times observed socket peak.

Release thresholds:

- server error rate below 1%;
- p95 reads below 500 ms;
- p95 writes below 1 second;
- bounded MongoDB, Redis, storage, and processor timeouts;
- no unbounded result sets, retries, queue concurrency, or in-memory tenant state.

Profile before adding business-data caching. Record the query plan, payload size, latency distribution, dependency timing, and resource saturation for each optimization.
