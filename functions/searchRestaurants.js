// functions/searchRestaurants.js
const fetch = require('node-fetch'); // For making HTTP requests from Node.js

exports.handler = async function(event, context) {
    // Access the API key securely from environment variables
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;

    // Parse query parameters from the frontend request
    const { query, location, radius, minRating, minRatedBy, maxPrice } = event.queryStringParameters;

    // Construct the Google Places API URL
    // This is a simplified example for Text Search.
    // You would build this URL dynamically based on your frontend filters.
    const googleApiUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query || 'restaurants in New Zealand')}&key=${apiKey}`;

    // Add more parameters based on your filters (e.g., radius, minprice, maxprice, min_rating)
    // Example: if (radius) googleApiUrl += `&radius=${radius}`;
    // Example: if (minRating) googleApiUrl += `&min_rating=${minRating}`;

    try {
        const response = await fetch(googleApiUrl);
        const data = await response.json();

        // Process Google Places API response to match your desired restaurant card format
        const processedResults = data.results.map(place => {
            // This is a simplified mapping. You'll need to adjust based on actual Places API response structure.
            const photoReference = place.photos && place.photos.length > 0 ? place.photos[0].photo_reference : null;
            const photoUrl = photoReference ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photoReference}&key=${apiKey}` : `https://placehold.co/600x400/F97316/FFFFFF?text=${encodeURIComponent(place.name)}`;

            // Dummy pros/cons for now, as Places API doesn't provide this directly
            // You'd need a separate mechanism or LLM call for this in a real app
            const dummyProsCons = {
                pros: ['Highly recommended', 'Great atmosphere'],
                cons: ['Can be busy']
            };

            return {
                id: place.place_id,
                name: place.name,
                type: place.types ? place.types.map(t => t.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())).join(', ') : 'Restaurant',
                distance: 'N/A (requires client-side location or more complex API calls)', // Places API doesn't directly give distance without origin
                price: '$'.repeat(place.price_level || 1), // Price level is 1-4
                rating: place.rating || 'N/A',
                ratedBy: place.user_ratings_total || 0,
                photo: photoUrl,
                prosCons: dummyProsCons,
                googleMapLink: `https://maps.google.com/?q=${encodeURIComponent(place.name)},${encodeURIComponent(place.formatted_address || '')}`,
                phone: place.international_phone_number || 'N/A' // Requires Place Details API call
            };
        });

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*", // Allow CORS from your frontend
            },
            body: JSON.stringify(processedResults),
        };
    } catch (error) {
        console.error('Error fetching from Google Places API:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to fetch restaurant data' }),
        };
    }
};
