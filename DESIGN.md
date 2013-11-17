# Implementation notes

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
    on the consensus view of history and message contents. May
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

  - *Peer*: a collection of agents and carried groups, usually located on a
    specific machine. A peer typically encrypts its agents under a secret
    passphrase for storage when it is inactive. When active, a peer is the
    root data structure for accessing agents. Every peer has a tag for
    debugging use but it is generally unimportant. Multiple peers may be
    joined together via a single designated backplane group.

  - *Backplane*: a special kind of group that a set of peers use to
    synchronize their "root" peer-state through. Any message written to
    the backplane of a set of peers is taken up unquestioningly by all
    peers connected to it. A backplane group should only be used to keep
    two or more peers (devices) owned by the same person, and subject to the
    same trust considerations, in sync. Backplanes should be used sparingly
    since there is no cross-validation of messages, trust is absolute
    (a message exists => it is trusted). A peer is only ever a member of
    at most one backplane group.

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

  - *Drop*: A peer that runs strictly for the purpose of being findable and
    propagating messages between other peers. A drop participates in a
    private conversation with a non-drop (active) peer, in which the active
    peer repeatedly injects content-meaning messages and the drop just
    emits pings in response, carrying on the key rotation protocol.


Current capability is multi-group, one-group-per-web-ui, no verification.

Joining a group involves being invited. An invite requires only conveying a
server-you-can-get-the-group-from, a group ID, and a group symmetric key.
The newly-invited member tag should be added to the group before sending
the invite, so the group does not rotate-away from the group ID in question
before the new invitee actually attempts to join.

