# Under the hood

How Sales copilot reads a call, what each file holds and what you can change.

## How it works

The app keeps apart two things that usually come mixed: answering questions about one turn, and drawing conclusions about the call.

**1. The questions.** Every turn gets a fixed set of questions, always the same:

- twelve yes or no signals, such as "the client raised an objection", "the client accepted the next step", "the seller asked an open question" and "the seller listed features without asking anything";
- seven facts that, once said, hold until the end of the call: the present situation, the problem in the client's words, the size of the problem, the value of solving it, money in the conversation, who decides and the timing;
- three notes of three levels: the tone of the conversation, how much the client takes part and how urgent it is for them;
- three choices: the stage of the call, the kind of objection and the move from your playbook that fits now.

Who answers depends on the mode. In a review and in practice, your AI does. Live, a decisions model on OpenRouter does: it only returns values and writes no text. In both cases, whoever answers computes nothing.

**2. The arithmetic.** The signal of each turn is the base of the stage the call is in plus the points of what showed up: a commitment from the client adds, an open objection takes away, the seller talking too much takes away. The signal you see moves gradually towards each turn's reading, so it does not jump with every sentence.

**3. The conclusions.** The app follows each objection from the turn where it opened to the turn where the client accepted the answer. An objection nobody touches for eight turns is marked as left unanswered. The roadmap is checked item by item, and the notes come from fixed rules: the price came before the client said what the problem costs, the call ended with no next step, the price was stated without knowing who decides.

Turns of one or two words with no question, such as "Sure", are not read, and the signal stays where it was.

## The files inside

Everything lives in the copiloto-de-vendas folder of your project.

- **The playbook.** It has four parts. "business" holds what you sell, the price, the next step and the alternatives, each with its origin and date. "moves" holds the moves, each with when to use it, when not to and its sentences. "roadmap" holds the call's roadmap, with the suggested question for each missing item. Ask the AI to change sentences, add a move or change the roadmap.
- **Each call's folder.** The document for you to read, the turns with their origin and date, the answers given to each turn and the computed reading.
- **The weights.** The file exists only if you change one. Without it, the app's weights apply.

A number only enters a playbook sentence when it is in "business". If a sentence carries a price or a percentage you did not give, the app points at the sentence and reads no calls until it is fixed.

## Advanced requests

> "Raise the weight of the open objection to 20 points and redo the reading of the last call."

> "Add a move to the playbook for when the client asks for a discount, with three sentences of mine."

> "Change the roadmap to my process: diagnosis, proposal and contract."

> "Compare the latest calls and tell me which roadmap item I miss most."

> "Open the live copilot with a ceiling of 1 dollar and 90 minutes."

Changing a weight does not ask the questions again: each turn's answers are kept, and the reading is recomputed at once.

## The checks

- **Answers.** Each answer is checked field by field. A stage that does not exist, a note out of range or a move that is not in the playbook is refused with the field's path, and the AI fixes only that field.
- **Coverage.** The document says how many turns were read, how many were too short and how many were left unread.
- **Weights.** The document says the signal is a rule of thumb, the date of the weights and whether your project adjusted them. The app's weights are a starting point and were not measured on real calls.
- **Comparing calls.** Below ten calls with an outcome on each side, the comparison is marked as an indication.
- **Live spending.** The page adds up the cost OpenRouter reports with each response. At the ceiling, it stops asking the service and keeps recording the turns. Transcription by Gemini uses your Google key and stays out of that sum; the page says when Gemini is the one listening. When transcription goes through OpenRouter and the service does not report its cost, the page estimates it from the length of the speech and marks the value as estimated.
- **Who listens.** With the Gemini key, Gemini does. If it refuses the key, the following stretches go through OpenRouter. With neither, the turns are typed.
- **Live time.** The page closes by itself at the agreed time, 120 minutes unless you ask for another, and writes the reading before closing.

## With other apps

Other flyee.club apps can ask this one for the reading of a call and read the computed result: the stages, the objections, the roadmap items and the signal turn by turn. This app calls no other.

## Privacy

- **What stays on your computer.** The transcripts, the turns, the answers, the documents and the playbook, all in the project folder.
- **What leaves in a review and in practice.** The turns go to your AI, like any file it reads.
- **What leaves on a live call.** With each turn, the twelve most recent turns and the questions go to OpenRouter. With the microphone or the meeting's audio on, each stretch of speech goes to Gemini to be transcribed, or to OpenRouter when there is no Gemini key. The keys stay outside the project and never show in the conversation, on the page or in the files.
- **The call page.** It opens only on your computer, at an address that is valid for that call. It loads nothing from outside and refuses requests coming from other sites.
- **The client.** Transcribing a conversation involves another person's data. Tell the client beforehand; the AI asks this every time you request the live mode.
