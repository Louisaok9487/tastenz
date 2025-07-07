// functions/searchRestaurants.js
const fetch = require('node-fetch'); // You might need to install this: npm install node-fetch

exports.handler = async function(event, context) {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    const { query, location, radius, min_rating, price_level } = event.queryStringParameters;

    // Basic validation
    if (!apiKey) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Server configuration error: API key not found.' }),
        };
    }

    // --- Step 1: Construct the Google Places API URL (Text Search example) ---
    let googleApiUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?key=${apiKey}`;

    let searchText = query || 'restaurants';
    if (location && location !== 'new zealand') { // Include location if specific
        searchText += ` in ${location}`;
    } else {
        searchText += ` in New Zealand`; // Default to New Zealand
    }
    googleApiUrl += `&query=${encodeURIComponent(searchText)}`;

    // Add filters (adjust according to Places API documentation)
    if (min_rating) {
        googleApiUrl += `&min_rating=${parseFloat(min_rating)}`;
    }
    if (price_level) {
        googleApiUrl += `&maxprice=${parseInt(price_level) * 10}`; // Example mapping for price_level
    }
    // Note: 'radius' and 'min_rated_by' are more complex with Places API
    // Radius typically requires 'location' (lat/lng) and 'type' for Nearby Search.
    // min_rated_by is not a direct filter in Places API search.

    try {
        // --- Step 2: Make the API Call to Google Places ---
        const googleResponse = await fetch(googleApiUrl);
        const googleData = await googleResponse.json();

        if (googleData.status !== 'OK') {
            console.error('Google Places API Error:', googleData.status, googleData.error_message);
            return {
                statusCode: 500,
                body: JSON.stringify({ error: `Google Places API error: ${googleData.status} - ${googleData.error_message || 'No results or API error.'}` }),
            };
        }

        // --- Step 3: Process Google Places API response ---
        const processedResults = await Promise.all(googleData.results.map(async place => {
            // Get photo URL
            const photoReference = place.photos && place.photos.length > 0 ? place.photos[0].photo_reference : null;
            const photoUrl = photoReference
                ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photoReference}&key=${apiKey}`
                : `https://placehold.co/600x400/F97316/FFFFFF?text=${encodeURIComponent(place.name || 'Restaurant')}`;

            // Fetch Place Details for phone number (optional, adds another API call)
            let phone = 'N/A';
            if (place.place_id) {
                const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=international_phone_number,reviews&key=${apiKey}`;
                try {
                    const detailsResponse = await fetch(detailsUrl);
                    const detailsData = await detailsResponse.json();
                    if (detailsData.status === 'OK' && detailsData.result) {
                        phone = detailsData.result.international_phone_number || 'N/A';
                        // Process reviews for pros/cons (simplified)
                        const reviews = detailsData.result.reviews || [];
                        // This is a very basic way to get pros/cons. A real implementation would involve NLP.
                        const pros = reviews.length > 0 ? [`"${reviews[0].text.substring(0, 50)}..."`] : ['Good reviews overall'];
                        const cons = []; // Placeholder
                        place.prosCons = { pros, cons };
                    }
                } catch (detailError) {
                    console.warn(`Could not fetch details for ${place.name}:`, detailError);
                }
            }

            // Map Google data to your frontend format
            return {
                id: place.place_id,
                name: place.name,
                type: place.types ? place.types.filter(t => t !== 'point_of_interest' && t !== 'establishment').map(t => t.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())).join(', ') : 'Restaurant',
                distance: 'N/A (requires user location)', // Still requires user's actual location
                price: '$'.repeat(place.price_level || 1),
                rating: place.rating || 'N/A',
                ratedBy: place.user_ratings_total || 0,
                photo: photoUrl,
                prosCons: place.prosCons || { pros: ['Popular choice'], cons: [] }, // Fallback
                googleMapLink: `https://maps.google.com/?q=${encodeURIComponent(place.name)},${encodeURIComponent(place.formatted_address || '')}`,
                phone: phone
            };
        }));

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*", // Allow CORS from your frontend
            },
            body: JSON.stringify(processedResults),
        };
    } catch (error) {
        console.error('Error in Netlify Function:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: `Internal Server Error: ${error.message}` }),
        };
    }
};
