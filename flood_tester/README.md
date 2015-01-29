PubNub Flood Tester
===================

Trying to figure out how to get more than 10 messages per second over Pubnub's network.

The Server
----------
The server starts 200 public connect channels. They listen for presence notifications. There are 200 to avoid overloading the presence notification of each channel. When a 'join' is detected it creates a private pair of channels for the client to send and receive on. It counts all the 'count' messages received on its private channels and outputs the Counts Per Second as 'CPS'.

The Client
----------
The client starts as many clients as you like, perfoms the connect prototcol and then rotates through each client sending a message to the server after a specified delay.



Setup
-----
npm install

Usage
-----

Start the server:
$ node server.js


Start the client:
$ node runTest.js <number of clients> <millisecond delay between messages>

For instance:

$ node runTest.js 10 100

Means to start 10 clients and rotate through them sending messages every 100 miliseconds.
