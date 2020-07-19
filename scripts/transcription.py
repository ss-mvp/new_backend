# from sys import stdin, stdout
# from json import loads, dumps
# from decouple import config
# from datauri import DataURI
# from google.cloud import vision
# from google.cloud.vision import types
# from google.oauth2 import service_account
# import os
# import urllib.request

# api_key = config("GOOGLE_APPLICATION_CREDENTIALS")
# api_key = loads(api_key)
# api_key = service_account.Credentials.from_service_account_info(api_key)
# client = vision.ImageAnnotatorClient(credentials=api_key)

from sys import stdin, stdout
from json import loads, dumps
from decouple import config
from datauri import DataURI

from google.cloud import vision
from google.cloud.vision import types
from google.oauth2 import service_account

import urllib.request

api_key = config("GOOGLE_APPLICATION_CREDENTIALS")
api_key = loads(api_key)
api_key = service_account.Credentials.from_service_account_info(api_key)
client = vision.ImageAnnotatorClient(credentials=api_key)


def transcribe(uri):
    # Parses a URI and gets the encoded data string out
    data = DataURI(uri).data
    image = types.Image(content=data)
    response = client.document_text_detection(image)

    if response.text_annotations:
        return response.text_annotations[0].description.replace('\n', ' ')
    else:
        return "No Text"


# To be replaced with a function that gets the metadata out of the function
def nothing(transcript):
    return {"nada": "nothing"}


# Input list of URIs
def process_images(uris):
    # Map functions are used to take iterable data structures like list, maps, etc. and make a map
    # that consist of the data of the original data structure after being run through a function.
    # Outputs a map (list like data structure) of all the uris after being transcribed
    transcripts = map(transcribe, uris)
    # Outputs a map (list like data structure) of all the transcriptions after having the meta data parsed
    metadata = map(nothing, transcripts)
    return {'images': list(transcripts), 'metadata': list(metadata)}

# def check_singles(text):
#     singles = {}
#     the_word = ''
#     flagged = False
#     with open('scripts/bad_single.csv', 'r') as bs:
#         for word in bs:
#             word = word.strip(',')
#             # if word not in singles:
#             singles[word] = True

#     text = text[0].split(' ')
#     result = []
#     for words in text:
#         # result.append(type(words.lower().replace(',', '')))
#         words = words.lower().replace(',', '')
#         if words in singles:
#             the_word = words
#             flagged = True
#         else:
#             continue

#     return [flagged, the_word]

def check_singles(text):
    singles = {}
    the_word = ''
    flagged = False
    with open('scripts/bad_single.csv', 'r') as bs:
        for word in bs:
            word = word.replace(',', '').replace('\n', '')
            # if word not in singles:
            singles[word] = True

    text = text[0].split(' ')
    result = []
    for words in text:
        # result.append(type(words.lower().replace(',', '')))
        words = words.lower().replace(',', '')
        if words in singles:
            the_word = words
            flagged = True
            break
        else:
            continue

    return {"isFlagged": flagged, "flag": the_word}

def check_phrases(text):
    phrases = {}
    phrase = ''
    flagged = False
    with open('scripts/bad_phrases.csv', 'r') as bp:
        for words in bp:
            words = words.replace(',', '').replace('\n', '')
            if words in text[0]:
                flagged = True
                phrase = words
                break
    
    return {"isFlagged": flagged, "flag": phrase}

# Input: JSON String in the transcribable data structure
# Output: JSON String of the data being processed into transcripts and metadata
def main(transcribable):
    json = loads(transcribable)
    transcriptions = process_images(json['images'])
    # Check the single word CSV for bad words
    singles_flagged = check_singles(transcriptions['images'])
    if singles_flagged['isFlagged']:
        transcriptions['flagged'] = singles_flagged
    else:
        # Check the bad phrase CSV for matches
        phrase_flagged = check_phrases(transcriptions['images'])
        transcriptions['flagged'] = phrase_flagged
    return dumps(transcriptions)


# Reads in from stdin the entire input as a string
data = stdin.read()

# Runs the main function using the input string and saving the output string
output = main(data)

# Prints the output string to stdout
stdout.write(output)


# Can be tested with this command
# pipenv run python3 dotPy/transcription.py < integration/src/transcription_test.json

# Notice how the `test.json` is piped into stdin with the `<`