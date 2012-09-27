# Sneakertext

This is an experimental tool for carrying on secure group
conversations. Compared to similar tools, it has a number of unusual
properties, that may or may not be important depending on how
much you're a fussy cryptographer. Explanations are grouped by
audience:

## If you are an end-user

At the moment, it's **not ready** for end-users. You can only just
barely play around with an ugly, confusing, incomplete and broken
user-interface that looks a bit like IRC with a lot of random
looking cryptographic noise in the titles and nicknames. Assuming
someone put the code on a server for you to play with. It's
mostly useless right now. It's only for developers.

Eventually, if we finish it, it'll have more interesting
properties:

  - You'll be able to carry on secret conversations with friends,
    both one-on-one and among-a-group, that nobody outside that
    group can see (unless, of course, someone involved "leaks"
    copies of the conversation to someone else)

  - No 3rd party is necessarily involved in mediating the
    conversation; not even at a _transport_ level. That is,
    you'll reasonably be able to have the conversation _between
    phones directly_, using their local radios, not sending your
    conversation through the phone network or internet.

  - Your words, and your friends words, are not so strongly
    linked to you that you can't deny ever having said them; to
    some extent you are protected from your past conversations.

  - Multiple devices can all share responsibility for your sense
    of identity, for speaking as you, for sharing access to the
    conversations you're involved in.

  - Multiple _people_ can easily share an identity, in the sense
    of speaking with one voice or blurring the identity of an
    individual author.

  - You have a stable identity but it can't reasonably be lost,
    broken or stolen. It's something established and verified on
    an ongoing basis by your participation, by you showing up and
    being who you are. It's not a key, and you don't need to keep
    anything perfectly safe or secret over the long term.

  - Nobody can easily get a list of all the conversations going
    on in the system as a whole, or find new ones, or even tell
    how many real people are using the system, or how many
    machines are using it, etc. etc.

## If you're a developer without much crypto background

Naturally you should be aware of all the end-user-visible
properties above, but it might help to frame them with the
following technical details:

  - It's a _peer-to-peer_ system with no distinguished roles for
    clients vs. servers, supernodes or such, except in edge cases
    of setting up particular communication links (bluetooth or
    HTTP or such). Data-carrying responsibility is spread through
    the system, falling out somewhat naturally from the (private,
    local) social relationships between groups.

  - It's an _asynchronous_ system, with no need for all the peers
    to be "online" at once, nor enumerable, nor even periodically
    relating through a single transport. Peers and transports
    don't really have strong roles; they're more like buckets in
    which a content graph is (lazily) mirrored-around. The
    central data structure is a lot like the content DAGs in git,
    and you should think of the online/offline properties as
    similarly asynchronous, distributed and transport-agnostic.

  - It's a _private-only_ system. There are no "public" groups or
    ways of communicating. There are only secret groups, and you
    have to be a member to read/write the contents. The only way
    to do something "public" is to copy plaintext out, or
    explicitly break the normal operating modes (eg. disable key
    rotation and publish a group's key, say).

  - It's an _ephemeral_ system. Keys are ephemeral and
    continuously renegotiated. Groups are malleable and
    forward-secret: point-in-time ability to decrypt or
    participate does not grant a partcipant any insight into, or
    proof about, the contents of past or future messages in a
    group. Users are expected to lose devices, reformat clients,
    use temporary machines, forget passwords, reveal single keys
    accidentally, etc. etc. None of these events should represent
    system disruption or catastrophic failure for an individual
    or group.

  - It's an _anarchic_ system, even at the level of an individual
    group: groups protect secrecy and induce a carrying-graph,
    but to not provide any other authority mechanism. All members
    of a group are equally empowered, and can all lie about their
    identity, kick one another out, change their names, or the
    like. There's no ACL system, no ownership, no read-write
    vs. read-only modes. The only primitive is "group
    membership", which you can always figure out by merely trying
    to decrypt a message. If you have a key that can decrypt it,
    you're a member. If you want to make a read-only view of a
    group, or a restricted / revokable sub-group, make a second
    group and copy messages into it.

  - It's implemented in javascript, not by necessity but as a
    sort of forced constraint for simplification and ease of
    deployment. This includes all the crypto. Modern JS engines
    are pretty fast. It should be possible to implement in any
    other language.

  - As a bundle-of-code, the JS in question runs on both "client"
    (web-browser) and "server" (node.js process). We'll move
    towards using WebRTC PeerConnection/DataChannels when we get those
    working, at which point the "servers" will just be STUN/TURN
    things. Later: phone radios.

  - While the prototype here is oriented towards working over the
    internet, and there's no reason why it shouldn't continue to
    be usable that way for people comfortable using the internet,
    it's intended to be (re)implemented as a cell-phone app that
    can communicate phone-to-phone or phone-to-deaddrop using the
    "local" radios (WiFi, Bluetooth, NFC, UWB, ZigBee, DASH7,
    etc.), where users just physically transport the phones
    around for longer-range hops. That's where the name is from
    ("sneakernet" + "text messaging").

  - It's a very small codebase with very few moving parts; with a
    little care and understanding of the details, one should be
    able to reimplement the core protocol and structures in a few
    days of hacking. This is intentional, a design-goal.

  - It uses cryptographic primitives that are a fair bit more
    modern and efficient than most other comparable systems.

  - If you're familiar with the difference between
    public-key/asymmetric crypto and secret-key/symmetric crypto:
    this system runs almost entirely using secret-key modes. The
    only time public/asymmetric key primitives get used are
    ephemerally, to negotiate new secret/symmetric keys.

## If you're familiar with PGP and X.509, but not much newer

Sneakertext runs on newer and more-interesting primitives. You
should probably take a bit of time out before studying it to
learn how the following systems work:

  - [Diffie-Hellman key exchange] [dh]
  - [Multi-Party Diffie-Hellman] [mpdh]
  - [Perfect Forward Secrecy] [pfs]
  - [Deniable Authentication] [da]
  - [Off-the-record messaging] [otr]
  - [Multi-Party Off-the-record messaging] [mpotr]
  - [Kleeq] [kleeq]
  - [Elliptic Curve Crypto] [ecc]
  - [Elliptic Curve Diffie-Hellman] [ecdh]
  - [Curve 25519] [curve25519]
  - [Authenticated Encryption] [ae]
  - [CCM mode] [ccm]

## If you're familiar with all of the above

You should have a pretty good guess by here of what you're
looking at, but a few more notes on the odd / interesting
properties to help frame the code:

  - Deriving the design:

    - Start with Kleeq as last-described in the literature.

    - Implement in JS, trim as much complexity as possible.

    - Replace the Lamport clocks with Git-like content DAGs,
      merging the verification phase and communication phase and
      simplifying the group-management protocol.

    - Upgrade the multiparty DH to Curve25519, speeding things up
      and shrinking the keys and whatnot.

    - Remove the stable public keys entirely. Names are public
      information, like in reality, and you can use someone
      else's name if you like; it's up to higher-level comparison
      of communication histories to inform trust decisions.


  - The last part is the weird one, so we'll repeat here: There
    are _no long-lived keys_. This is novel. It means that
    identity is _latent_ in the communication-graph structure,
    and gets _weaker_ the more people there are in a group who
    can lie about who's saying what; verification is online,
    based on active communication, and is stronger the smaller
    the group. A two-person group gets you some degree of
    certainty. I.e. if you're Alice, you verify Bob's "identity"
    by asking Carol to convey a secret you chose to whoever _she_
    thinks of as Bob, and check to see the same secret shows up
    in the channel _you_ think you have with Bob. There are no
    private key-halfs to steal (or lose), and all such
    "verifications" are intrinsically only meaningful to the
    verifying party. If someone has MITM'ed all your channels,
    you're SOL anyways.

  - To repeat and make this concrete: user "names" are entirely
    non-cryptographic. Not key-hashes or anything. They're a
    combination of a nickname and a random nonce, the latter only
    to help avoid accidental collision when used at a global
    scale. Anyone can use anyone else's name at any time, and the
    names aren't connected to keys in any way other than "a
    person who is usually using name X also controls a machine
    that has a symmetric membership-key for group Y"; a latent
    fact that isn't expressed as any signature or proof, just a
    fact that can be observed interactively given a willing user.

This system is, in other words, intended as a counter-argument to
the idea of PKI. It's our hypothesis that PKI is a mistake _as an
idea_, that public key crypto is beguiling and pretty to
cryptographers, but is an _anti-feature_ when considering the
security needs and intuitions of real humans: contextual,
pseudonymous, deniable and recoverable identities, windows of
vulnerablity limited by time and communication acts, and variable
certainty that's inversely proportional to the (more socially
detectable) communication-disruption effort of your adversary,
not their (secretive) computing-power, or control of particular
devices. We propose that security systems will match humans needs
better by moving _away_ from models of identity adhering to
single keys, no matter how many bits are employed or how
tamper-proof the device is made.

Note that while _most_ of the code in sneakertext does not depend
on this rejection-of-PKI (you could fork it, swap in a system of
long-lived keys and signatures as the user identities, and
probably be back in business in a weekend of work), it's
important to understand that the current design is
_intentionally_ a departure from a PKI model (web-of-trust or
otherwise), and will only return to that sort of thing if the
current avenue proves untenable for some other reason.


# Implementation notes

## Implementation status

Very preliminary:
  - No same-user-tag / multi-device UI
  - No multi-group UI
  - No password UI, uses fixed client password and doesn't
    encrypt agent table yet anyways (as it must)
  - Client and server both use very inefficient storage
  - Sync is brute force
  - Server does not serve client code over SSL or HSTS
  - No as-an-addon version of client code yet
  - No p2p modes between browsers yet, nor phone versions
  - Rotation is missing important checks
  - No code to support the inter-group verification cycles
  - Just a sketch of data structures and algorithms

## Concept vocabulary:

  - *Tag*: a nickname + nonce pair. Public.

  - *Message*: a plaintext carrying sender-tag, message kind,
    group ID, timestamp, ancestor-hashes, key rotation parameters,
    and body.

  - *Message ID*: hash of a message (plaintext).

  - *Envelope*: a message encrypted with group symmetric key.

  - *Envelope ID*: Hash of ciphertext.

  - *Group ID*: hash of a symmetric key, not a tag.

  - *Group*: combination of concepts, depending on use:
    - A collection of envelopes addressed to a group ID.
    - The decrypted view of the messages contained therein,
      including a cryptographic DAG based on the parent-hashes.
    - A combination of a current ID (key hash), persistent-state
      (a general multimap), and current-epoch message graph.

  - *Graph*: A cryptographic DAG, similar to in git. It gives us
    causal order (avoiding Lamport clocks) and integrity checks
    on the concensus view of history and message contents. May
    lead to jarring time-travel effects of messages appearing
    "in the past" in your current UI because you just got patched
    by someone carrying causally "older" messages. Reality does
    not follow linear-causal rules, so any linearization of
    the message graph is going to reflect some such possibility.
    We use the timestamp as a self-claimed tie-breaker when
    causality doesn't yield any better order.

  - *State*: A multimap of general values that gets re-transmitted
    at each rotation, used to store things the users want to be
    visible over extended (multi-rotation) periods within the
    group. Includes member-list or similar things.

  - *Epoch*: a group's message graph, between first-use of a new key,
    and rotation to a new-new key.

  - *Rotation*: every message carries multiparty ECDH parameters
    advancing negotiation of the group's next key. When the next
    key is negotiated, the members all jump ship to the new group,
    updating whatever links they had pointing to the current group ID
    to point to the new one.

  - *Completion*: when a group's members have negotiated a next
    key, an epoch finishes, the persistent state is re-encrypted
    under the new key, the key is hashed to make the new group ID,
    and the old ID (and its messages) eventually gets GC'ed.

  - *Members*: Part of the persistent state of a group: a list of
    tags of the people who should be involved in a key negotiation.
    Also called Agency.

  - *Agent*: the combination of a user-tag, a group, and symmetric key to
    decrypt the group, and current and next ECC keypairs for negotiation
    of the symmetric key(s). "Having agency" means you are participating in
    a group. The members of a group are synonymous with the set of
    user tags who have agency in it.

  - *Peer*: a collection of agents and carried groups.

  - *Links*: persistent state can carry links to other groups by ID, not
    by tag; group A linking to group B means that members of A will all
    carry B. But will not necessarily _be_ members of B itself, nor even
    know what B is called (in terms of tag). Just carry it, as a sort
    of redundant transport service for those other peers who _are_
    members.

  - *Carrying*: A peer carries all the groups it has agency within,
    as well as the groups _linked_ by the groups it has agency within.
    A peer does not necessarily have agency in all groups it carries,
    but it does keep copies and propagate changes to the group-to-group
    links made by other peers. Peers do not carry any groups beyond the
    threshold of agency - no-agency; peers are not obliged to carry the
    whole world worth of messages, nor even a random selection thereof.
    They carry stuff that's either relevant to themselves, or relevant
    to someone they know.

  - *GC*: old groups get collected when all members have committed
    to the new rotation key (written messages into the new group ID).

Current capability is multi-group, one-group-per-web-ui, no verification.

Joining a group involves being invited. An invite requires only conveying a
server-you-can-get-the-group-from, a group ID, and a group symmetric key.
The newly-invited member tag should be added to the group before sending
the invite, so the group does not rotate-away from the group ID in question
before the new invitee actually attempts to join.

[dh]: https://en.wikipedia.org/wiki/Diffie-Hellman_key_exchange
[mpdh]: https://en.wikipedia.org/wiki/Diffie-Hellman_key_exchange#Operation_with_more_than_two_parties
[pfs]: https://en.wikipedia.org/wiki/Perfect_forward_secrecy
[da]: https://en.wikipedia.org/wiki/Deniable_authentication
[otr]: https://en.wikipedia.org/wiki/Off-the-Record_Messaging
[mpotr]: http://www.cypherpunks.ca/~iang/pubs/mpotr.pdf
[kleeq]: http://cacr.uwaterloo.ca/techreports/2007/cacr2007-03.pdf
[ecc]: https://en.wikipedia.org/wiki/Elliptic_curve_cryptography
[ecdh]: https://en.wikipedia.org/wiki/Elliptic_curve_Diffie-Hellman
[ae]: https://en.wikipedia.org/wiki/Authenticated_encryption
[curve25519]: http://cr.yp.to/ecdh.html
[ccm]: https://en.wikipedia.org/wiki/CCM_mode
